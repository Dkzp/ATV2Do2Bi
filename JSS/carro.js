class CarroBase {
    /**
     * Cria uma instância de um veículo base.
     * @param {string} id - O identificador único do veículo. Essencial.
     * @param {string} modelo - O modelo do veículo (ex: "Fusca"). Essencial.
     * @param {string} [cor='Padrão'] - A cor do veículo.
     * @param {string} [imagemSrc='default_car.png'] - Caminho ou Base64 da imagem.
     * @param {string} [placa=''] - A placa do veículo.
     * @param {number|string} [ano=''] - O ano de fabricação.
     * @param {string|Date|null} [dataVencimentoCNH=null] - Data de vencimento CNH.
     * @throws {Error} Se `id` ou `modelo` não forem fornecidos.
     */
    constructor(id, modelo, cor, imagemSrc = 'default_car.png', placa = '', ano = '', dataVencimentoCNH = null) {
        if (!id || !modelo) throw new Error("ID e Modelo são obrigatórios para criar um veículo.");
        this.id = id;
        this.modelo = String(modelo || 'Modelo Padrão').trim();
        this.cor = String(cor || 'Cor Padrão').trim();
        this.imagemSrc = imagemSrc || 'default_car.png'; // Guarda caminho ou Base64
        this.placa = String(placa || '').trim().toUpperCase();
        this.ano = parseInt(ano) || null; // Converte para número ou null se inválido/vazio.

        // Processamento robusto da data da CNH (aceita string ISO ou Date)
        // Prioriza objeto Date se já for um. Converte string YYYY-MM-DD para Date UTC.
        if (dataVencimentoCNH instanceof Date && !isNaN(dataVencimentoCNH.getTime())) {
            this.dataVencimentoCNH = dataVencimentoCNH;
        } else if (typeof dataVencimentoCNH === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataVencimentoCNH)) {
            // Tenta converter string YYYY-MM-DD para Date (tratando como UTC para evitar problemas de fuso)
            const dataConvertida = new Date(dataVencimentoCNH + 'T00:00:00Z');
            this.dataVencimentoCNH = !isNaN(dataConvertida.getTime()) ? dataConvertida : null;
        } else {
            this.dataVencimentoCNH = null; // Define como null para qualquer outro caso inválido
        }

        // Estado inicial do veículo.
        this.velocidade = 0;
        this.ligado = false;
        /** @type {Manutencao[]} */
        this.historicoManutencao = []; // Array para armazenar instâncias de Manutencao.
        /** @type {string} Guarda o tipo da classe para serialização/deserialização */
        this.tipoVeiculo = 'CarroBase'; // Definido no construtor base, sobrescrito nas subclasses
    }

    // --- Ações Comuns ---

    /** Liga o veículo. */
    ligar() {
        if (!this.ligado) {
            this.ligado = true;
            this.tocarSom('som-ligar');
            this.atualizarInformacoesUI("Ligou"); // Informa a origem para debug/log.
        }
    }

    /** Desliga o veículo. */
    desligar() {
        if (this.ligado) {
            this.ligado = false;
            this.velocidade = 0; // Ao desligar, o carro para.
            this.tocarSom('som-desligar');
            // Se for esportivo, desativa o turbo ao desligar
            if (this instanceof CarroEsportivo && this.turboAtivado) {
                this.turboAtivado = false;
            }
            this.atualizarInformacoesUI("Desligou");
        }
    }

    /** Aumenta a velocidade (pode ser sobrescrito). */
    acelerar() {
        if (this.ligado) {
            const VELOCIDADE_MAXIMA_BASE = 200;
            this.velocidade = Math.min(this.velocidade + 10, VELOCIDADE_MAXIMA_BASE);
            this.tocarSom('som-acelerar');
            this.atualizarInformacoesUI("Acelerou");
        } else {
            this.notificarUsuario(`Ligue o ${this.modelo} para acelerar!`);
        }
    }

    /** Diminui a velocidade. */
    frear() {
        if (this.velocidade > 0) {
            this.velocidade = Math.max(this.velocidade - 15, 0); // Garante que não fique negativa.
            this.tocarSom('som-frear');
            this.atualizarInformacoesUI("Freou");
        }
    }

    /** Aciona a buzina. */
    buzinar() {
        this.tocarSom('som-buzinar');
        console.log(`Veículo ${this.id} (${this.modelo}) buzinou.`);
        // Buzinar geralmente não requer atualização completa da UI.
    }

    // --- Manutenção ---

    /**
     * Adiciona um registro de manutenção ao histórico.
     * @param {Manutencao} m - A instância de Manutencao a ser adicionada.
     * @returns {boolean} `true` se adicionado e salvo com sucesso.
     */
    adicionarManutencao(m) {
        // Valida a instância recebida ANTES de adicionar
        if (!(m instanceof Manutencao && m.validar())) {
            this.notificarUsuario("Dados da manutenção inválidos. Verifique data e tipo.");
            console.warn("Tentativa de adicionar manutenção inválida:", m);
            return false;
        }
        // Garante que historicoManutencao é um array
        if (!Array.isArray(this.historicoManutencao)) {
            this.historicoManutencao = [];
        }
        this.historicoManutencao.push(m);
        // Reordena: Manutenções futuras vêm primeiro, depois as passadas mais recentes.
        // Ordena por data descendente (mais recentes/futuras primeiro)
        this.historicoManutencao.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));

        // Tenta salvar a garagem APÓS a modificação em memória
        if (salvarGaragem()) {
            // Se salvou com sucesso, atualiza a UI
            this.atualizarInformacoesUI("Manut Adicionada"); // Atualiza a view deste veículo
            atualizarExibicaoAgendamentosFuturos(); // Atualiza a lista global de agendamentos
            verificarAgendamentosProximos();       // Atualiza notificações de manutenção próxima
            return true;
        } else {
             // Se salvar falhou, DESFAZ a adição em memória para manter consistência
             this.historicoManutencao.pop(); // Remove o último item adicionado
             // Reordena novamente se necessário (embora pop seja do fim)
             // this.historicoManutencao.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
             console.error("Falha ao salvar garagem após adicionar manutenção. Alteração desfeita na memória.");
             // O alerta sobre falha no salvamento já foi dado por salvarGaragem()
             return false;
        }
    }

    /**
     * Obtém o histórico de manutenções formatado, separado.
     * @returns {{passadas: string[], futuras: string[]}} Objeto com arrays de strings.
     */
    getHistoricoManutencaoFormatado() {
        const agora = new Date();
        // Filtra apenas manutenções válidas antes de processar.
        const histValido = (this.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data.getTime()));

        // Separa e formata usando os métodos apropriados de Manutencao.
        // Ordena as passadas da mais recente para a mais antiga (já feito no adicionar, mas garante aqui)
        const passadas = histValido
                            .filter(m => m.data <= agora)
                            .sort((a, b) => b.data.getTime() - a.data.getTime()) // Mais recentes primeiro
                            .map(m => m.formatar());
        // Ordena as futuras da mais próxima para a mais distante (já feito no adicionar)
        const futuras = histValido
                           .filter(m => m.data > agora)
                           .sort((a, b) => a.data.getTime() - b.data.getTime()) // Mais próximas primeiro
                           .map(m => m.formatarComHora());

        return { passadas, futuras };
    }

    /**
     * Remove TODOS os registros de manutenção deste veículo.
     * @returns {void}
     */
    limparHistoricoManutencao() {
        const historicoAntigo = [...this.historicoManutencao]; // Faz cópia caso precise reverter
        this.historicoManutencao = [];
        // Tenta salvar a alteração
        if (salvarGaragem()) {
            // Se salvou, atualiza a UI
            this.atualizarInformacoesUI("Hist Limpo");
            atualizarExibicaoAgendamentosFuturos(); // Atualiza a lista geral.
            verificarAgendamentosProximos();
        } else {
            // Se falhou ao salvar, REVERTE a limpeza na memória
            console.error("Falha ao salvar garagem após limpar histórico. Histórico restaurado na memória.");
            this.historicoManutencao = historicoAntigo;
            // O alerta de erro já foi dado por salvarGaragem().
            // Poderia forçar uma atualização da UI aqui para mostrar que não limpou, mas pode ser confuso.
        }
    }

    // --- UI e Métodos Auxiliares ---

    /**
     * Atualiza a seção de exibição no HTML com os dados ATUAIS desta instância.
     * **Importante:** Só executa a atualização se o `data-veiculo-id` da área de display
     * corresponder ao `id` deste veículo.
     * @param {string} [origem="Desconhecida"] - String opcional para identificar o gatilho da atualização (ajuda no debugging).
     * @returns {void}
     */
    atualizarInformacoesUI(origem = "Desconhecida") {
        const displayArea = document.getElementById('veiculo-display-area');
        // Condição crucial: só atualiza se este for o veículo ativo na UI.
        if (!displayArea || displayArea.dataset.veiculoId !== this.id) {
            // console.log(`UI Update SKIPPED para ${this.id}. Motivo: Não é o veículo ativo (${displayArea?.dataset.veiculoId}). Origem: ${origem}`);
            return; // Sai silenciosamente se não for o veículo ativo
        }
        // console.log(`UI Update EXECUTANDO para ${this.id}. Origem: ${origem}`);

        // Mini-funções auxiliares para simplificar manipulação do DOM DENTRO do displayArea.
        const getEl = (sel) => displayArea.querySelector(sel);
        const setTxt = (sel, txt) => { const el = getEl(sel); if (el) el.textContent = txt ?? ''; }; // Usa ?? para tratar null/undefined como ''
        const setHtml = (sel, html) => { const el = getEl(sel); if (el) el.innerHTML = html ?? ''; };
        const setCls = (sel, base, st) => { const el = getEl(sel); if (el) el.className = `${base} ${st}`; }; // Sobrescreve classes
        const setProp = (sel, prop, val) => { const el = getEl(sel); if (el) el[prop] = val; }; // Para propriedades como value, checked, disabled
        const setStyle = (sel, prop, val) => { const el = getEl(sel); if (el) el.style[prop] = val; }; // Para estilos inline
        const setAttr = (sel, attr, val) => { const el = getEl(sel); if (el) el.setAttribute(attr, val); }; // Para atributos como title, data-*
        const setImg = (sel, src, alt) => {
            const el = getEl(sel);
            if (el && el instanceof HTMLImageElement) { // Garante que é uma imagem
                const fallbackSrc = 'default_car.png'; // Imagem padrão genérica
                // Define o src. Se src for inválido ou nulo, o fallback será usado no onerror.
                el.src = src || fallbackSrc;
                el.alt = alt || `Imagem ${this.modelo}`;
                // Define o onerror para carregar o fallback se a imagem principal falhar
                el.onerror = () => {
                    if (el.src !== fallbackSrc) { // Evita loop se o próprio fallback falhar
                        console.warn(`Falha ao carregar imagem: ${src}. Usando fallback: ${fallbackSrc}`);
                        el.src = fallbackSrc;
                    }
                    el.onerror = null; // Remove o handler após a primeira falha para evitar loops
                };
            } else if(el) {
                 console.warn(`Elemento selecionado por "${sel}" não é uma tag <img>.`);
            }
        };

        // --- Atualização dos Elementos da UI ---
        setTxt('.veiculo-titulo', this.modelo);
        setImg('.veiculo-imagem', this.imagemSrc, `Imagem ${this.modelo}`);
        setTxt('.veiculo-status', this.ligado ? "Ligado" : "Desligado");
        setCls('.veiculo-status', 'veiculo-status', this.ligado ? "status-ligado" : "status-desligado");
        setTxt('.veiculo-velocidade', this.velocidade);
        setTxt('.veiculo-placa', this.placa || '-');
        setTxt('.veiculo-ano', this.ano || '-');

        // Info extra (polimórfico: depende do tipo real da instância).
        let extraInfo = '';
        if (this instanceof CarroEsportivo) {
            extraInfo = `<span class="info-label">Turbo:</span> ${this.turboAtivado ? 'ON <i class="fa-solid fa-fire" style="color: orange;"></i>' : 'OFF'}`;
            // Atualiza texto/ícone do botão Turbo dinamicamente
            const btnTurbo = getEl('.btn-turbo'); // Busca pelo botão específico
            if(btnTurbo) btnTurbo.innerHTML = `<i class="fa-solid fa-bolt"></i> ${this.turboAtivado ? 'Turbo ON' : 'Turbo OFF'}`;
        } else if (this instanceof Caminhao) {
            extraInfo = `<span class="info-label">Carga:</span> ${this.cargaAtual} / ${this.capacidadeCarga} kg`;
            // Poderia desabilitar o botão de carregar se a capacidade for atingida, por exemplo
            const cargaInput = getEl('.carga-input');
            const cargaBtn = getEl('.carga-container button[data-acao="carregar"]');
            if (cargaInput && cargaBtn) {
                cargaBtn.disabled = this.cargaAtual >= this.capacidadeCarga;
                if (cargaBtn.disabled) cargaInput.placeholder = "Carga Máxima";
                else cargaInput.placeholder = "Ex: 500";
            }
        }
        setHtml('.veiculo-info-extra', extraInfo);

        // Info CNH com checagem de vencimento e classes CSS.
        let cnhInfo = '<span class="info-label">Venc. CNH:</span> -';
        let cnhClasseStatus = 'cnh-ok'; // Classe CSS padrão
        if (this.dataVencimentoCNH instanceof Date && !isNaN(this.dataVencimentoCNH.getTime())) {
            const dtVenc = this.dataVencimentoCNH;
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0); // Normaliza hoje para comparar só data.
            // Calcula diferença em dias, arredondando para cima
            const diffTime = dtVenc.getTime() - hoje.getTime();
            const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Formata data para exibição (usando UTC para evitar problemas de fuso na exibição)
            const dtFmt = dtVenc.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            cnhInfo = `<span class="info-label">Venc. CNH:</span> ${dtFmt}`;
            if (diasRestantes < 0) {
                cnhInfo += ' <span class="cnh-status">(VENCIDA!)</span>';
                cnhClasseStatus = 'cnh-vencida';
            } else if (diasRestantes <= 30) {
                cnhInfo += ` <span class="cnh-status">(Vence em ${diasRestantes}d!)</span>`;
                cnhClasseStatus = 'cnh-vence-breve';
            }
        }
        setHtml('.veiculo-cnh-info', cnhInfo);
        // Aplica a classe de status ao elemento pai para estilização global se necessário
        const cnhInfoEl = getEl('.veiculo-cnh-info');
        if (cnhInfoEl) {
             // Remove classes antigas e adiciona a nova
             cnhInfoEl.classList.remove('cnh-ok', 'cnh-vencida', 'cnh-vence-breve');
             cnhInfoEl.classList.add(cnhClasseStatus);
        }

        // Atualiza velocímetro visual (barra e ponteiro).
        let maxVel = 200; // Padrão CarroBase
        if (this instanceof CarroEsportivo) maxVel = 250;
        else if (this instanceof Caminhao) maxVel = 140;
        // Garante que maxVel seja positivo para evitar divisão por zero
        maxVel = Math.max(1, maxVel);

        // Calcula percentual da barra (0 a 100)
        const perc = Math.min(Math.max(0, (this.velocidade / maxVel) * 100), 100);
        setStyle('.veiculo-barra-progresso', 'width', `${perc}%`);

        // Calcula ângulo do ponteiro (-90 a +90 graus)
        const angulo = Math.min(Math.max(0, (this.velocidade / maxVel) * 180), 180) - 90;
        setStyle('.veiculo-ponteiro', 'transform', `translateX(-50%) rotate(${angulo}deg)`);

        // Atualiza histórico de manutenções (passadas).
        const histDiv = getEl('.lista-historico');
        if (histDiv) {
            const { passadas } = this.getHistoricoManutencaoFormatado(); // Pega só as passadas formatadas
            histDiv.innerHTML = passadas.length > 0 ?
                `<ul>${passadas.map(item => `<li>${item}</li>`).join('')}</ul>` :
                '<p>Nenhuma manutenção passada registrada.</p>';
        }

        // ---- LIMPEZA DA ÁREA DE DETALHES DA API (Parte 1) ----
        // Garante que, ao interagir com o carro (ligar, acelerar, etc.),
        // a área de detalhes extras seja limpa, forçando uma nova busca se o usuário clicar no botão de novo.
        setHtml('.detalhes-extras-area', '<p><i>(Detalhes da API não carregados.)</i></p>'); // Ou apenas ''
        // Reabilita o botão de detalhes caso ele tenha sido desabilitado e a UI foi atualizada por outra ação
        const btnDetalhes = getEl('.btn-detalhes-extras');
        if (btnDetalhes) btnDetalhes.disabled = false;
        // ---- FIM DA LIMPEZA ----


        // Preenche formulário de edição com os dados atuais.
        const editForm = getEl('.edicao-veiculo');
        if (editForm) {
            setProp('.edit-modelo-veiculo', 'value', this.modelo);
            setProp('.edit-cor-veiculo', 'value', this.cor);
            setProp('.edit-placa-veiculo', 'value', this.placa);
            setProp('.edit-ano-veiculo', 'value', this.ano || ''); // Usa '' se ano for null
            // Formata data para YYYY-MM-DD para o input type="date" (usando UTC para evitar off-by-one)
            const cnhInputValue = this.dataVencimentoCNH instanceof Date && !isNaN(this.dataVencimentoCNH)
                ? this.dataVencimentoCNH.toISOString().split('T')[0]
                : '';
            setProp('.edit-cnh-veiculo', 'value', cnhInputValue);

            // Limpa preview de imagem da edição SE não houver arquivo selecionado no input file
             const editImgInput = editForm.querySelector('.edit-imagem-input');
             const editImgPreview = editForm.querySelector('.edit-imagem-preview');
             if (editImgInput && editImgPreview && !editImgInput.files[0]) {
                 editImgPreview.src = '#'; // Limpa src
                 editImgPreview.style.display = 'none'; // Esconde a tag img
             }
             // Se já houver um arquivo selecionado, o preview deve ter sido atualizado pelo listener do input
        }
    } // Fim de atualizarInformacoesUI

    /**
     * Toca um arquivo de áudio HTML pelo ID.
     * Reinicia o áudio se já estiver tocando e trata erros comuns.
     * @param {string} id - O ID do elemento `<audio>` no HTML.
     * @returns {void}
     */
    tocarSom(id) {
        const audio = document.getElementById(id);
        if (audio && audio instanceof HTMLAudioElement) {
             // Tenta tocar. O navegador pode bloquear se não houver interação prévia do usuário.
             const playPromise = audio.play();
             if (playPromise !== undefined) {
                 playPromise.then(() => {
                     // Áudio começou a tocar (ou já estava tocando)
                     audio.currentTime = 0; // Reinicia para permitir toques rápidos
                 }).catch(error => {
                     // Erro ao tocar. Comum: 'NotAllowedError' antes da interação do usuário.
                     // Não vamos poluir o console com o NotAllowedError.
                     if (error.name !== 'NotAllowedError') {
                         console.warn(`Erro ao tocar áudio ID "${id}":`, error);
                     }
                 });
             }
        } else if(id){ // Só avisa se o ID foi fornecido mas não encontrado/inválido
            // console.warn(`Elemento de áudio com ID "${id}" não encontrado ou não é um <audio>. Som não será tocado.`);
        }
    }

    /**
     * Exibe uma mensagem de alerta simples para o usuário.
     * @param {string} msg - A mensagem a ser exibida.
     * @returns {void}
     */
    notificarUsuario(msg) {
        alert(`${this.modelo}: ${msg}`); // Simples `alert` para feedback rápido.
    }

    /**
     * Converte o estado atual do veículo para um objeto JSON serializável.
     * Inclui o `tipoVeiculo` para permitir recriar a instância correta.
     * @returns {object} Um objeto simples representando o veículo.
     */
    toJSON() {
        // Serializa o histórico, garantindo que apenas manutenções válidas sejam incluídas.
        const histSerializado = (this.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.validar()) // Garante que são instâncias válidas
            .map(m => m.toJSON()) // Converte cada Manutencao válida para seu JSON
            .filter(mJson => mJson !== null); // Filtra nulos (caso toJSON de Manutencao retorne null por data inválida)

        // Determina o tipo da classe dinamicamente para reconstrução.
        // O tipo já está definido em this.tipoVeiculo (mais robusto)
        // let tipoVeiculo = 'CarroBase';
        // if (this instanceof CarroEsportivo) tipoVeiculo = 'CarroEsportivo';
        // else if (this instanceof Caminhao) tipoVeiculo = 'Caminhao';

        // Objeto base com dados comuns.
        const data = {
            id: this.id,
            modelo: this.modelo,
            cor: this.cor,
            placa: this.placa,
            ano: this.ano,
            // Salva data como string ISO 8601 YYYY-MM-DDTHH:mm:ss.sssZ ou null
            dataVencimentoCNH: this.dataVencimentoCNH instanceof Date && !isNaN(this.dataVencimentoCNH)
                ? this.dataVencimentoCNH.toISOString()
                : null,
            velocidade: this.velocidade,
            ligado: this.ligado,
            imagemSrc: this.imagemSrc, // Salva path ou Base64.
            tipoVeiculo: this.tipoVeiculo, // Usa a propriedade definida no construtor/subclasse
            historicoManutencao: histSerializado
        };

        // Adiciona propriedades específicas das subclasses, se existirem.
        // Verificamos o tipoVeiculo para garantir consistência.
        if (this.tipoVeiculo === 'CarroEsportivo') {
            data.turboAtivado = this.turboAtivado;
        } else if (this.tipoVeiculo === 'Caminhao') {
            data.capacidadeCarga = this.capacidadeCarga;
            data.cargaAtual = this.cargaAtual;
        }
        // Adicionar outras propriedades específicas aqui se necessário

        return data;
    }
}