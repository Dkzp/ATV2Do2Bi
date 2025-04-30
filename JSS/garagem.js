// ==================================================
//      GERENCIAMENTO DA GARAGEM & PERSISTÊNCIA (LocalStorage)
// ==================================================

/**
 * Armazena o estado da garagem, mapeando IDs de veículo para suas instâncias.
 * @type {Object.<string, CarroBase>}
 */
let garagem = {};

/**
 * Chave única usada no LocalStorage para armazenar/recuperar os dados da garagem.
 * @const {string}
 */
const GARAGEM_KEY = 'garagemData_v8_apiSim'; // Atualize a versão se quiser

/**
 * Salva o estado atual da `garagem` no LocalStorage.
 * @returns {boolean} `true` se salvou com sucesso, `false` se houve erro.
 */
function salvarGaragem() {
    try {
        // Os objetos são serializados usando seus métodos toJSON()
        localStorage.setItem(GARAGEM_KEY, JSON.stringify(garagem));
        console.log(`Garagem salva no LocalStorage (Chave: ${GARAGEM_KEY}).`);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("ERRO DE QUOTA AO SALVAR: LocalStorage cheio! Provavelmente devido a imagens grandes.");
            alert("ERRO CRÍTICO AO SALVAR!\n\nO armazenamento local está cheio (provavelmente por causa de uma imagem grande).\nAs últimas alterações NÃO FORAM SALVAS.\n\nConsidere usar imagens menores ou remover itens.");
        } else {
            console.error("Erro inesperado ao salvar garagem:", e);
            alert("Ocorreu um erro inesperado ao salvar os dados da garagem.");
        }
        return false;
    }
}

/**
 * Carrega os dados da garagem do LocalStorage.
 * Recria as instâncias das classes corretas.
 * @returns {void}
 */
function carregarGaragem() {
    const dataJSON = localStorage.getItem(GARAGEM_KEY);
    garagem = {};
    let carregouOk = false;

    if (dataJSON) {
        try {
            const garagemData = JSON.parse(dataJSON);
            for (const id in garagemData) {
                const d = garagemData[id];
                if (!d?.id || !d?.modelo || !d?.tipoVeiculo) {
                    console.warn(`Dados inválidos/incompletos para ID ${id} no LocalStorage. Pulando.`);
                    continue;
                }

                let veiculoInstance;
                // Recria histórico ANTES de criar o veículo, se necessário
                const histRecriado = (d.historicoManutencao || [])
                    .map(m => (!m?.data || !m?.tipo) ? null : new Manutencao(m.data, m.tipo, m.custo, m.descricao))
                    .filter(m => m && m.validar()); // Apenas manutenções válidas

                try {
                    // Argumentos comuns para os construtores
                    const args = [d.id, d.modelo, d.cor, d.imagemSrc, d.placa, d.ano, d.dataVencimentoCNH];
                    switch (d.tipoVeiculo) {
                        case 'CarroEsportivo':
                            veiculoInstance = new CarroEsportivo(...args);
                            veiculoInstance.turboAtivado = d.turboAtivado || false;
                            break;
                        case 'Caminhao':
                            veiculoInstance = new Caminhao(...args, d.capacidadeCarga || 0);
                            veiculoInstance.cargaAtual = d.cargaAtual || 0;
                            break;
                        case 'CarroBase': // Garante que CarroBase seja recriado corretamente
                        default: // Trata CarroBase e tipos desconhecidos como CarroBase
                            veiculoInstance = new CarroBase(...args);
                            break;
                    }
                    // Restaura estado e histórico
                    veiculoInstance.velocidade = d.velocidade || 0;
                    veiculoInstance.ligado = d.ligado || false;
                    veiculoInstance.historicoManutencao = histRecriado;
                    garagem[id] = veiculoInstance;

                } catch (creationError) {
                    console.error(`Erro crítico ao recriar instância do veículo ${id}. Pulando.`, creationError, d);
                }
            }
            console.log("Garagem carregada do LocalStorage.");
            carregouOk = true;
        } catch (e) {
            console.error("Erro ao parsear ou processar dados da garagem do LocalStorage:", e);
            alert("Erro ao carregar dados salvos. Resetando para garagem padrão.");
            localStorage.removeItem(GARAGEM_KEY);
            garagem = {};
        }
    }

    if (!carregouOk) {
        console.log("Nenhum dado válido encontrado ou erro. Inicializando com veículos padrão.");
        inicializarVeiculosPadrao(); // Cria e salva os padrões
    } else {
        atualizarInterfaceCompleta(); // Atualiza UI com dados carregados
    }
}

/**
 * Inicializa a `garagem` com veículos de exemplo.
 * @returns {void}
 */
function inicializarVeiculosPadrao() {
    garagem = {};
    try {
        console.log("Criando veículos padrão...");
        // IDs correspondem aos do dados_veiculos_api.json
        garagem['carro1'] = new CarroBase("carro1", "Fusca", "Azul", "default_car.png", "ABC1234", 1975, "2024-12-31");
        garagem['carro2'] = new CarroEsportivo("carro2", "Maverick", "Laranja", "default_sport.png", "DEF5678", 1974, "2025-06-01");
        garagem['cam1'] = new Caminhao("cam1", "Scania 113", "Vermelho", "default_truck.png", "GHI9012", 1995, "2023-01-10", 20000); // CNH vencida

        // Adiciona algumas manutenções (adicionarManutencao já salva a garagem)
        garagem['carro1']?.adicionarManutencao(new Manutencao('2023-11-15T10:00:00Z', 'Troca Pneu', 250));
        garagem['cam1']?.adicionarManutencao(new Manutencao('2024-01-10T14:30:00Z', 'Revisão Motor', 1200, 'Fumaça estranha'));

        console.log("Veículos padrão criados em memória.");
        // Tenta salvar esta configuração inicial (adicionarManutencao já tentou, mas garantimos aqui)
        if (!salvarGaragem()) {
            console.warn("Falha ao salvar a garagem padrão inicial.");
        }
    } catch (e) {
        console.error("Erro crítico ao inicializar veículos padrão:", e);
        alert("Erro grave ao criar veículos padrão.");
        garagem = {}; // Reseta se deu erro grave
    }
    atualizarInterfaceCompleta(); // Atualiza UI com os padrões (mesmo se salvar falhou)
}


// ==================================================
//      ATUALIZAÇÃO DA INTERFACE GERAL (UI)
// ==================================================

/**
 * Atualiza todos os componentes principais da interface.
 * @returns {void}
 */
function atualizarInterfaceCompleta() {
    console.log("Atualizando interface completa...");
    atualizarMenuVeiculos();
    atualizarExibicaoAgendamentosFuturos();
    verificarVencimentoCNH();
    verificarAgendamentosProximos();

    const veiculosIds = Object.keys(garagem);
    const displayArea = document.getElementById('veiculo-display-area');
    const idVeiculoAtual = displayArea?.dataset.veiculoId;

    if (veiculosIds.length === 0) {
        limparAreaDisplay(true); // Mostra msg de garagem vazia
    } else {
        // Tenta manter o veículo selecionado, se ainda existir
        if (idVeiculoAtual && garagem[idVeiculoAtual]) {
             marcarBotaoAtivo(idVeiculoAtual);
             // Apenas atualiza a UI se o template já estiver renderizado
             if (displayArea.querySelector('.veiculo-renderizado')) {
                 garagem[idVeiculoAtual].atualizarInformacoesUI("Atualização Completa");
             } else {
                 // Renderiza se a área estava com placeholder
                 renderizarVeiculo(idVeiculoAtual);
             }
        } else {
             // Se nenhum selecionado ou o selecionado foi removido, exibe o primeiro
             const primeiroId = veiculosIds[0] || null;
             if(primeiroId){
                marcarBotaoAtivo(primeiroId);
                renderizarVeiculo(primeiroId); // Renderiza o primeiro
             } else {
                // Caso raro onde garagem tinha itens mas agora está vazia
                limparAreaDisplay(true);
             }
        }
    }
    console.log("Interface completa atualizada.");
}

/**
 * Limpa a área de exibição do veículo.
 * @param {boolean} [mostrarMsgGaragemVazia=false] - Se true, mostra msg "Garagem vazia".
 * @returns {void}
 */
function limparAreaDisplay(mostrarMsgGaragemVazia = false) {
    const displayArea = document.getElementById('veiculo-display-area');
    if (displayArea) {
        const msg = mostrarMsgGaragemVazia ?
            '<div class="placeholder"><i class="fa-solid fa-warehouse"></i> Garagem vazia. Adicione um veículo!</div>' :
            '<div class="placeholder"><i class="fa-solid fa-hand-pointer"></i> Selecione um veículo no menu acima.</div>';
        displayArea.innerHTML = msg;
        delete displayArea.dataset.veiculoId; // Remove ID associado
    }
}

/**
 * Atualiza o menu de botões de seleção de veículo.
 * @returns {void}
 */
function atualizarMenuVeiculos() {
    const menu = document.getElementById('menu-veiculos');
    if (!menu) return;
    menu.innerHTML = ''; // Limpa menu antigo
    const ids = Object.keys(garagem);

    if (ids.length === 0) {
        menu.innerHTML = '<span class="empty-placeholder">Sua garagem está vazia <i class="fa-regular fa-face-sad-tear"></i></span>';
        return;
    }

    // Ordena IDs (opcional, por nome do modelo por exemplo)
    ids.sort((a, b) => (garagem[a]?.modelo || '').localeCompare(garagem[b]?.modelo || ''));

    ids.forEach(id => {
        const v = garagem[id];
        if (v) { // Verifica se o veículo realmente existe
            const btn = document.createElement('button');
            btn.textContent = v.modelo || `Veículo ${id}`; // Nome ou fallback
            btn.dataset.veiculoId = id; // Guarda ID no botão
            btn.title = `${v.modelo || '?'} (${v.placa || 'S/P'}) - ${v.ano || '?'}`; // Tooltip útil
            btn.addEventListener('click', () => {
                marcarBotaoAtivo(id); // Marca botão como ativo
                renderizarVeiculo(id); // Renderiza o veículo clicado
            });
            menu.appendChild(btn);
        }
    });
}

/**
 * Marca visualmente o botão do veículo ativo no menu.
 * @param {string} id - O ID do veículo ativo.
 * @returns {void}
 */
function marcarBotaoAtivo(id) {
    document.querySelectorAll('#menu-veiculos button').forEach(b => {
        b.classList.toggle('veiculo-ativo', b.dataset.veiculoId === id);
    });
}


// ==================================================
//       RENDERIZAÇÃO DINÂMICA DO VEÍCULO (Template)
// ==================================================

/**
 * Renderiza os detalhes e controles de um veículo usando o template.
 * @param {string} veiculoId - O ID do veículo a ser renderizado.
 * @returns {void}
 */
function renderizarVeiculo(veiculoId) {
    const veiculo = garagem[veiculoId];
    const displayArea = document.getElementById('veiculo-display-area');
    const template = document.getElementById('veiculo-template');

    if (!veiculo || !displayArea || !template || !(template instanceof HTMLTemplateElement)) {
        console.error(`Erro ao tentar renderizar ${veiculoId}: Pré-requisitos inválidos.`);
        limparAreaDisplay(); // Mostra placeholder padrão
        return;
    }

    console.log(`Renderizando veículo: ${veiculo.modelo} (ID: ${veiculoId})`);

    const clone = template.content.cloneNode(true); // Clona o conteúdo do <template>
    const container = clone.querySelector('.veiculo-renderizado'); // Pega o container principal do clone
    if (!container) {
         console.error("Estrutura do #veiculo-template inválida: .veiculo-renderizado não encontrado.");
         return;
    }

    // --- Adiciona Listeners ESPECÍFICOS para este veículo DENTRO do clone ---

    // Botões de Ação Genéricos (Ligar, Acelerar, Frear, Buzinar, Desligar)
    container.querySelectorAll('.acoes-veiculo button[data-acao]').forEach(btn => {
        const acao = btn.dataset.acao;
        // Só adiciona listener se for ação genérica (não Turbo/Carga aqui)
        if (acao && !['ativarTurbo', 'carregar'].includes(acao)) {
             btn.addEventListener('click', () => interagirVeiculoAtual(acao));
        }
    });

    // Botões Específicos (Excluir, Salvar Edição, Limpar Histórico)
    container.querySelector('.btn-excluir-veiculo')?.addEventListener('click', () => handleExcluirVeiculo(veiculoId));
    container.querySelector('.salvar-veiculo-btn')?.addEventListener('click', () => handleSalvarEdicaoVeiculo(veiculoId));
    container.querySelector('.btn-limpar-historico')?.addEventListener('click', () => handleLimparHistorico(veiculoId));

    // Formulário de Agendamento
    container.querySelector('.form-agendamento')?.addEventListener('submit', (e) => handleAgendarManutencao(e, veiculoId));


    // --- Listener para o BOTÃO DE DETALHES EXTRAS (API SIMULADA) ---
    const btnDetalhes = container.querySelector('.btn-detalhes-extras');
    const areaDetalhes = container.querySelector('.detalhes-extras-area');

    if (btnDetalhes && areaDetalhes) {
        btnDetalhes.addEventListener('click', async () => { // Listener ASÍNCRONO
            areaDetalhes.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Carregando detalhes...</p>'; // Feedback inicial
            btnDetalhes.disabled = true; // Desabilita enquanto busca

            try {
                // Chama a função que busca na API simulada
                const detalhes = await buscarDetalhesVeiculoAPI(veiculoId);

                if (detalhes) {
                    // Se encontrou, formata e exibe
                    let htmlDetalhes = '<ul>';
                    for (const chave in detalhes) {
                        // Não mostra o ID de novo, já sabemos
                        if (chave !== 'id') {
                            let valor = detalhes[chave];
                            // Formatações especiais para melhorar a exibição
                            if (chave === 'valorFIPE' && typeof valor === 'number') {
                                valor = `R$ ${valor.toFixed(2).replace('.', ',')}`;
                            } else if (chave === 'recallPendente' && typeof valor === 'boolean') {
                                valor = valor ? '<strong style="color:red;">Sim</strong>' : 'Não';
                            } else if (chave === 'proximaRevisaoRecomendada') {
                                // Tenta formatar data se for válida (YYYY-MM-DD)
                                const dataRec = new Date(valor + 'T00:00:00Z'); // Usa Z para tratar como UTC
                                if (!isNaN(dataRec.getTime())) {
                                    valor = dataRec.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                }
                                // Se não for data válida, mostra como texto
                            }
                            // Formata a chave: camelCase -> Título com Espaços
                            const chaveFormatada = chave.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            htmlDetalhes += `<li><strong>${chaveFormatada}:</strong> ${valor || '-'}</li>`; // Mostra '-' se valor for nulo/vazio
                        }
                    }
                    htmlDetalhes += '</ul>';
                    // Adiciona info extra sobre recall se houver motivo
                    if (detalhes.motivoRecall) {
                        htmlDetalhes += `<p class="recall-info"><i class="fa-solid fa-triangle-exclamation"></i> Motivo Recall: ${detalhes.motivoRecall}</p>`;
                    }
                    areaDetalhes.innerHTML = htmlDetalhes; // Insere o HTML gerado
                } else {
                    // Mensagem se não encontrou detalhes ou deu erro na API
                    areaDetalhes.innerHTML = '<p><i class="fa-regular fa-circle-xmark"></i> Detalhes extras não encontrados ou erro na consulta.</p>';
                }
            } catch (error) {
                // Captura erros inesperados DENTRO deste listener (pouco provável se buscarDetalhesVeiculoAPI tratar erros)
                console.error("Erro no listener do botão de detalhes:", error);
                areaDetalhes.innerHTML = '<p><i class="fa-solid fa-bomb"></i> Ocorreu um erro inesperado ao processar os detalhes.</p>';
            } finally {
                 btnDetalhes.disabled = false; // REABILITA o botão no final (sucesso ou erro)
            }
        });
    }
    // --- FIM do Listener de Detalhes Extras ---


    // Listener para Preview de Imagem na Edição
    const editImgInput = container.querySelector('.edit-imagem-input');
    const editImgPreview = container.querySelector('.edit-imagem-preview');
    if (editImgInput && editImgPreview) {
        editImgInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => { // Mostra preview (Base64)
                    editImgPreview.src = e.target.result;
                    editImgPreview.style.display = 'block';
                };
                reader.onerror = () => { // Limpa em caso de erro
                     editImgPreview.src = '#'; editImgPreview.style.display = 'none';
                     console.error("Erro lendo arquivo de imagem para preview (edição).");
                 };
                reader.readAsDataURL(file); // Lê como Base64
            } else { // Limpa preview se arquivo inválido ou removido
                editImgPreview.src = '#'; editImgPreview.style.display = 'none';
            }
        });
    }

    // Configura Ações Específicas de Subclasses (Turbo/Carga) dinamicamente
    const acaoExtraEl = container.querySelector('.acao-extra');
    if (acaoExtraEl) {
        acaoExtraEl.innerHTML = ''; // Limpa ações extras anteriores
        if (veiculo instanceof CarroEsportivo) {
            // Adiciona botão Turbo
            const btn = document.createElement('button');
            btn.dataset.acao = 'ativarTurbo';
            // Ícone e texto serão atualizados pelo atualizarInformacoesUI
            btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Turbo`;
            btn.title = "Ativar/Desativar Turbo";
            btn.classList.add('btn-turbo'); // Adiciona classe para fácil seleção
            btn.addEventListener('click', () => interagirVeiculoAtual('ativarTurbo'));
            acaoExtraEl.appendChild(btn);
        } else if (veiculo instanceof Caminhao) {
            // Adiciona input e botão Carregar
            const div = document.createElement('div');
            div.className = 'carga-container';
            // Usa ID único para label/input (boa prática)
            const inputId = `carga-input-${veiculoId}`;
            div.innerHTML = `
                <label for="${inputId}">Carga(kg):</label>
                <input type="number" min="1" id="${inputId}" class="carga-input" placeholder="Ex: 500">
                <button data-acao="carregar" title="Adicionar Carga"><i class="fa-solid fa-truck-ramp-box"></i> Carregar</button>`;
            const cargaBtn = div.querySelector('button[data-acao="carregar"]');
            const inputCarga = div.querySelector('input.carga-input');
            if (cargaBtn && inputCarga) {
                // Listener passa o INPUT como argumento extra
                cargaBtn.addEventListener('click', () => interagirVeiculoAtual('carregar', inputCarga));
                // Opcional: Enter no input também carrega
                 inputCarga.addEventListener('keypress', (e) => { if(e.key === 'Enter') interagirVeiculoAtual('carregar', inputCarga); });
            }
            acaoExtraEl.appendChild(div);
        }
    }

    // --- Finaliza a Renderização ---
    displayArea.innerHTML = ''; // Limpa conteúdo antigo da área de display
    displayArea.appendChild(clone); // Adiciona o novo conteúdo renderizado
    displayArea.dataset.veiculoId = veiculoId; // Associa o ID do veículo à área

    // Chama a atualização da UI do próprio veículo para preencher os dados iniciais.
    veiculo.atualizarInformacoesUI("Renderização Completa");
}


// ==================================================
//       INTERAÇÃO COM O VEÍCULO ATUALMENTE EXIBIDO
// ==================================================

/**
 * Chama a interação no veículo atualmente exibido.
 * @param {string} acao - A ação a ser executada.
 * @param {HTMLInputElement} [extraElement=null] - Elemento extra (ex: input de carga).
 * @returns {void}
 */
function interagirVeiculoAtual(acao, extraElement = null) {
    const displayArea = document.getElementById('veiculo-display-area');
    const veiculoId = displayArea?.dataset.veiculoId; // Pega ID do veículo ativo na UI

    if (veiculoId && garagem[veiculoId]) { // Verifica se ID e veículo existem
        // Tratamento especial para 'carregar': pega valor do input e limpa-o
        if (acao === 'carregar' && extraElement instanceof HTMLInputElement) {
            const valor = extraElement.value;
            interagir(veiculoId, acao, valor); // Passa o valor como argumento
            extraElement.value = ''; // Limpa o input após a ação
        } else {
            // Outras ações são chamadas sem argumento extra
            interagir(veiculoId, acao);
        }
    } else {
        console.warn("Nenhum veículo selecionado para interação ou ID inválido.");
        alert("Por favor, selecione um veículo válido primeiro.");
    }
}

/**
 * Centraliza a execução de ações em um veículo específico.
 * @param {string} veiculoId - O ID do veículo alvo.
 * @param {string} acao - A string identificadora da ação.
 * @param {any} [arg=null] - Argumento adicional para a ação.
 * @returns {void}
 */
function interagir(veiculoId, acao, arg = null) {
    const v = garagem[veiculoId];
    if (!v) {
        alert(`Erro: Veículo com ID ${veiculoId} não encontrado para a ação ${acao}.`);
        return;
    }
    console.log(`Interagir: Ação=${acao}, Veículo=${veiculoId} (${v.modelo}), Arg=${arg}`);
    try {
        // Switch para direcionar a ação ao método correto.
        switch (acao) {
            case 'ligar': v.ligar(); break;
            case 'desligar': v.desligar(); break;
            case 'acelerar': v.acelerar(); break; // Chama método polimórfico
            case 'frear': v.frear(); break;
            case 'buzinar': v.buzinar(); break;
            // Ações específicas de subclasses:
            case 'ativarTurbo':
                if (v instanceof CarroEsportivo) v.ativarTurbo();
                else v.notificarUsuario("Ação 'Turbo' apenas para Carros Esportivos.");
                break;
            case 'carregar':
                if (v instanceof Caminhao) v.carregar(arg); // Passa o argumento (peso)
                else v.notificarUsuario("Ação 'Carregar' apenas para Caminhões.");
                break;
            // Adicionar outras ações aqui se necessário
            default:
                // Ignora ações que são tratadas diretamente nos listeners (como 'buscar-detalhes')
                if (!['buscar-detalhes', 'salvar-edicao', 'excluir'].includes(acao)) {
                    console.warn(`Ação desconhecida ou não manipulada centralmente: ${acao}`);
                    // v.notificarUsuario(`Ação '${acao}' não implementada.`); // Evitar muitos alertas
                }
        }
        // Nota: A atualização da UI e salvamento são geralmente feitos DENTRO
        // dos métodos da classe do veículo ou nos handlers de evento maiores (como salvar edição).
    } catch (e) {
        console.error(`Erro ao executar ação '${acao}' no veículo ${veiculoId}:`, e);
        alert(`Ocorreu um erro ao tentar ${acao}. Verifique o console.`);
    }
}


// ==================================================
//          HANDLERS DE EVENTOS GLOBAIS / FORMULÁRIOS
// ==================================================

/**
 * Handler para clique nos botões de navegação por abas.
 * @param {string} abaId - ID do botão da aba clicada.
 * @returns {void}
 */
function handleTrocarAba(abaId) {
    document.querySelectorAll('.secao-principal').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('#abas-navegacao button').forEach(b => b.classList.remove('aba-ativa'));

    const secaoId = abaId === 'tab-garagem' ? 'secao-garagem' : 'secao-adicionar';
    document.getElementById(secaoId)?.classList.add('ativa');
    document.getElementById(abaId)?.classList.add('aba-ativa');
}

/**
 * Handler para o submit do formulário de adicionar novo veículo.
 * @param {Event} event - O objeto do evento submit.
 * @returns {void}
 */
function handleAdicionarVeiculo(event) {
    event.preventDefault(); // Impede recarregamento da página
    const form = event.target;

    // Coleta dados do formulário
    const mod = form.querySelector('#add-modelo').value.trim();
    const cor = form.querySelector('#add-cor').value.trim();
    const plc = form.querySelector('#add-placa').value.trim().toUpperCase();
    const ano = form.querySelector('#add-ano').value; // Será convertido para int ou null
    const tipo = form.querySelector('#add-tipo').value;
    const capIn = form.querySelector('#add-capacidade-carga');
    const capCg = (tipo === 'Caminhao' && capIn) ? capIn.value : 0; // Pega capacidade só se for caminhão
    const dtCnh = form.querySelector('#add-cnh').value; // String YYYY-MM-DD ou vazia
    const imgInput = form.querySelector('#add-imagem-input');
    const imgPreview = document.getElementById('add-imagem-preview');

    // Validação básica
    if (!mod || !tipo) {
        alert("Modelo e Tipo são obrigatórios!");
        return;
    }

    const nId = `v${Date.now()}`; // ID simples baseado em timestamp
    let nV; // Variável para a nova instância do veículo

    // Função interna para criar e adicionar o veículo (usada após ler imagem ou usar padrão)
    const criarEAdicionarVeiculo = (imagemSrc = null) => {
        try {
            // Define imagem padrão se nenhuma foi fornecida/lida
            let imgFinal = imagemSrc;
            if (!imgFinal) {
                switch (tipo) {
                    case 'CarroEsportivo': imgFinal = 'default_sport.png'; break;
                    case 'Caminhao': imgFinal = 'default_truck.png'; break;
                    default: imgFinal = 'default_car.png'; break;
                }
            }

            // Argumentos comuns para os construtores
            const args = [nId, mod, cor, imgFinal, plc, ano, dtCnh || null];

            // Cria instância da classe correta
            switch (tipo) {
                case 'CarroEsportivo': nV = new CarroEsportivo(...args); break;
                case 'Caminhao': nV = new Caminhao(...args, capCg); break;
                default: nV = new CarroBase(...args); break; // Inclui 'CarroBase'
            }

            garagem[nId] = nV; // Adiciona à garagem em memória

            // Tenta persistir a mudança
            if (salvarGaragem()) {
                // Sucesso: Atualiza UI e dá feedback
                atualizarMenuVeiculos(); // Recria botões do menu
                form.reset(); // Limpa o formulário
                document.getElementById('add-capacidade-carga-container').style.display = 'none'; // Esconde campo de carga
                if(imgPreview) { imgPreview.src='#'; imgPreview.style.display='none'; } // Limpa preview
                if(imgInput) imgInput.value = ''; // Limpa o input file
                handleTrocarAba('tab-garagem'); // Volta para a aba da garagem
                marcarBotaoAtivo(nId); // Marca o novo veículo no menu
                renderizarVeiculo(nId); // Exibe o novo veículo
                alert(`Veículo "${mod}" adicionado com sucesso!`);
            } else {
                // Falha ao salvar (ex: quota): Desfaz a adição em memória para manter consistência
                delete garagem[nId];
                // O alerta de erro já foi dado por salvarGaragem().
            }
        } catch (e) {
            console.error("Erro ao criar ou adicionar veículo:", e);
            alert("Erro ao adicionar veículo. Verifique os dados e o console.");
            // Garante remoção em caso de erro durante a criação da instância
            if (garagem[nId]) delete garagem[nId];
        }
    };

    // Processa a imagem SE uma foi selecionada no input file
    const file = imgInput?.files[0];
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Chama a função de criação passando a imagem lida (Base64)
            criarEAdicionarVeiculo(e.target.result);
        };
        reader.onerror = () => {
            console.error("Erro ao ler a imagem selecionada para adição. Usando imagem padrão.");
            alert("Houve um erro ao processar a imagem selecionada. O veículo será adicionado com a imagem padrão.");
            // Chama a função de criação sem imagem (usará a padrão)
            criarEAdicionarVeiculo(null);
        };
        reader.readAsDataURL(file); // Inicia a leitura como Base64
    } else {
        // Nenhuma imagem selecionada, chama a função para usar a padrão imediatamente
        criarEAdicionarVeiculo(null);
    }
}


/**
 * Handler para o botão "Salvar Edições" do veículo exibido.
 * @param {string} veiculoId - ID do veículo sendo editado.
 * @returns {void}
 */
function handleSalvarEdicaoVeiculo(veiculoId) {
    const v = garagem[veiculoId];
    const display = document.getElementById('veiculo-display-area');
    // Validações
    if (!v || !display || display.dataset.veiculoId !== v.id) {
        alert("Erro interno: Não foi possível identificar o veículo para salvar a edição.");
        return;
    }

    const form = display.querySelector('.edicao-veiculo');
    if (!form) {
        alert("Erro interno: Formulário de edição não encontrado na interface.");
        return;
    }

    console.log(`Iniciando salvamento de edições para ${veiculoId}`);
    let algumaMudancaDetectada = false; // Flag para verificar se algo mudou

    // --- Coleta e Compara Dados ---
    const novoModelo = form.querySelector('.edit-modelo-veiculo').value.trim();
    const novaCor = form.querySelector('.edit-cor-veiculo').value.trim();
    const novaPlaca = form.querySelector('.edit-placa-veiculo').value.trim().toUpperCase();
    const novoAno = parseInt(form.querySelector('.edit-ano-veiculo').value) || null; // Converte para int ou null
    const novaCnhString = form.querySelector('.edit-cnh-veiculo').value; // YYYY-MM-DD
    // Converte string para Date (UTC para consistência) ou null. Valida!
    let novaCnhDate = null;
    if (novaCnhString) {
        novaCnhDate = new Date(novaCnhString + 'T00:00:00Z');
        if (isNaN(novaCnhDate.getTime())) {
            novaCnhDate = null; // Invalida se a conversão falhar
            console.warn("Data de CNH inválida fornecida na edição.");
            // Poderia dar um alert aqui, mas a validação no final é mais segura
        }
    }

    // Compara e atualiza propriedades se houver mudança
    if (novoModelo && v.modelo !== novoModelo) { v.modelo = novoModelo; algumaMudancaDetectada = true; console.log("- Modelo alterado"); }
    if (v.cor !== novaCor) { v.cor = novaCor; algumaMudancaDetectada = true; console.log("- Cor alterada"); }
    if (v.placa !== novaPlaca) { v.placa = novaPlaca; algumaMudancaDetectada = true; console.log("- Placa alterada"); }
    if (v.ano !== novoAno) { v.ano = novoAno; algumaMudancaDetectada = true; console.log("- Ano alterado"); }
    // Compara datas pelo timestamp (funciona bem com Date e null)
    const cnhAtualTimestamp = v.dataVencimentoCNH instanceof Date ? v.dataVencimentoCNH.getTime() : null;
    const cnhNovaTimestamp = novaCnhDate instanceof Date ? novaCnhDate.getTime() : null;
    if (cnhAtualTimestamp !== cnhNovaTimestamp) {
         v.dataVencimentoCNH = novaCnhDate; // Atualiza com Date ou null
         algumaMudancaDetectada = true; console.log("- Data CNH alterada");
    }

    // --- Processamento da Imagem (se selecionada) ---
    const imagemInput = form.querySelector('.edit-imagem-input');
    const file = imagemInput?.files[0]; // Pega o arquivo selecionado (pode ser undefined)

    // Função para limpar input e preview de imagem
    const limparCamposImagemEdicao = () => {
         if(imagemInput) imagemInput.value = ''; // Limpa seleção de arquivo
         const p = form.querySelector('.edit-imagem-preview');
         if(p){ p.src='#'; p.style.display='none'; } // Limpa preview
    };

    // Função auxiliar para tentar salvar e dar feedback
    // Retorna true se salvou com sucesso, false caso contrário
    const tentarSalvarEAtualizarUI = (origemSalvar = "Edição") => {
        if (salvarGaragem()) {
            v.atualizarInformacoesUI(origemSalvar); // Atualiza a UI do veículo atual
            atualizarMenuVeiculos(); // Atualiza nome no menu se modelo mudou
            verificarVencimentoCNH(); // Reavalia alertas CNH se data mudou
            alert("Alterações salvas com sucesso!");
            limparCamposImagemEdicao(); // Limpa campos da imagem após sucesso
            return true;
        } else {
            // Falha ao salvar (provavelmente quota excedida se imagem foi a causa)
            // Alerta já foi dado por salvarGaragem()
            return false;
        }
    };


    // Lógica principal de salvamento:
    // 1. Se UMA NOVA IMAGEM FOI SELECIONADA:
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function(e) { // Callback quando a leitura da imagem terminar
            const novaImagemBase64 = e.target.result;
            // Só processa se a imagem for realmente diferente da atual (evita salvar sem necessidade)
            if (v.imagemSrc !== novaImagemBase64) {
                const imagemAntiga = v.imagemSrc; // Guarda imagem antiga para possível rollback
                v.imagemSrc = novaImagemBase64;   // ATUALIZA o objeto com a nova imagem (Base64).
                algumaMudancaDetectada = true;    // Marca que houve mudança (a imagem).
                console.log(`- Imagem ${veiculoId} alterada em memória (Base64). Tentando salvar...`);

                // TENTA SALVAR TUDO (incluindo a nova imagem).
                if (!tentarSalvarEAtualizarUI("Edição Salva c/ Img")) {
                    // FALHA AO SALVAR COM A NOVA IMAGEM (provavelmente Quota Excedida).
                    console.warn("Falha ao salvar garagem após atualizar imagem. Revertendo imagem...");
                    v.imagemSrc = imagemAntiga; // *** REVERTE A IMAGEM no objeto ***
                    algumaMudancaDetectada = (v.modelo !== novoModelo || v.cor !== novaCor || v.placa !== novaPlaca || v.ano !== novoAno || cnhAtualTimestamp !== cnhNovaTimestamp); // Reavalia se houve OUTRAS mudanças
                    // Tenta salvar DE NOVO, apenas com as OUTRAS alterações (se houver).
                    if (algumaMudancaDetectada) {
                        console.log("Tentando salvar novamente apenas as outras alterações...");
                        tentarSalvarEAtualizarUI("Edição Salva s/ Img (Após Falha Img)");
                    } else {
                         // Se não havia outras mudanças, apenas informa que a imagem falhou
                         // O alerta de falha já foi dado na primeira tentativa de salvar.
                         // Não limpamos o campo de imagem aqui, usuário pode querer tentar menor.
                         v.atualizarInformacoesUI("Falha Salvar Img"); // Atualiza UI para refletir reversão da imagem
                    }
                }
                // Se salvou com sucesso na primeira tentativa, o fluxo já encerrou.
            } else {
                // Imagem selecionada é igual à atual, apenas tenta salvar outras mudanças
                console.log("Imagem selecionada é a mesma. Verificando outras alterações...");
                if (algumaMudancaDetectada) {
                    tentarSalvarEAtualizarUI("Edição Salva s/ Img");
                } else {
                     alert("Nenhuma alteração detectada (incluindo imagem).");
                     limparCamposImagemEdicao(); // Limpa seleção de imagem mesmo sem mudança
                }
            }
        };
        reader.onerror = function() {
             alert("Erro ao ler o arquivo de imagem selecionado. Nenhuma alteração foi salva.");
             limparCamposImagemEdicao();
         };
        reader.readAsDataURL(file); // Inicia a leitura da imagem selecionada.

    }
    // 2. Se NENHUMA IMAGEM nova foi selecionada, MAS outros campos mudaram:
    else if (algumaMudancaDetectada) {
        console.log("Salvando alterações (sem mudança de imagem)...");
        tentarSalvarEAtualizarUI("Edição Salva s/ Img");
    }
    // 3. Se NADA mudou (nem imagem, nem outros campos):
    else {
        alert("Nenhuma alteração detectada.");
        limparCamposImagemEdicao(); // Limpa o input/preview de imagem mesmo sem salvar
    }
}


/**
 * Handler para o submit do formulário de agendar/adicionar manutenção.
 * @param {Event} event - Objeto do evento submit.
 * @param {string} veiculoId - ID do veículo alvo.
 * @returns {void}
 */
function handleAgendarManutencao(event, veiculoId) {
    event.preventDefault();
    const v = garagem[veiculoId];
    if (!v) {
        alert(`Erro: Veículo ${veiculoId} não encontrado para agendar manutenção.`);
        return;
    }
    const form = event.target;

    // Coleta dados do form de agendamento
    const dataInput = form.querySelector('.agendamento-data');
    const horaInput = form.querySelector('.agendamento-hora');
    const tipoInput = form.querySelector('.agendamento-tipo');
    const custoInput = form.querySelector('.agendamento-custo');
    const obsInput = form.querySelector('.agendamento-obs');

    // Validação básica de campos obrigatórios
    if (!dataInput || !tipoInput || !dataInput.value || !tipoInput.value.trim()) {
        alert('Data e Tipo de Serviço são obrigatórios para agendar/adicionar manutenção!');
        return;
    }

    const dataStr = dataInput.value; // YYYY-MM-DD
    const horaStr = horaInput?.value || '00:00'; // Usa 00:00 se hora não for fornecida
    const tipoStr = tipoInput.value.trim();
    const custoStr = custoInput?.value; // Pode ser string vazia
    const obsStr = obsInput?.value.trim();

    // Cria objeto Date combinando data e hora (interpretado no fuso local do navegador)
    const dataHoraCompleta = new Date(`${dataStr}T${horaStr}`);

    // Validação crucial da data/hora resultante
    if (isNaN(dataHoraCompleta.getTime())) {
        alert('Data ou Hora fornecida é inválida!');
        return;
    }

    // Cria a instância de Manutencao
    const novaManutencao = new Manutencao(dataHoraCompleta, tipoStr, custoStr, obsStr);

    // Adiciona ao veículo (método da classe já valida, salva e atualiza UI)
    if (v.adicionarManutencao(novaManutencao)) {
        alert('Manutenção adicionada/agendada com sucesso!');
        form.reset(); // Limpa o formulário após sucesso
    } else {
         // Se adicionarManutencao retornar false, um erro já ocorreu (provavelmente falha ao salvar)
         // O alerta/log de erro já foi dado dentro de adicionarManutencao ou salvarGaragem.
         console.warn("Falha ao adicionar manutenção via handler (provavelmente erro ao salvar).");
    }
}

/**
 * Handler para o botão de limpar histórico de manutenção.
 * @param {string} veiculoId - ID do veículo alvo.
 * @returns {void}
 */
function handleLimparHistorico(veiculoId) {
    const v = garagem[veiculoId];
    if (!v) {
        alert(`Erro: Veículo ${veiculoId} não encontrado para limpar histórico.`);
        return;
    }
    // Confirmação MUITO IMPORTANTE!
    if (confirm(`Tem certeza que deseja APAGAR TODO o histórico de manutenção de ${v.modelo}?\n\nEsta ação NÃO pode ser desfeita.`)) {
        try {
            v.limparHistoricoManutencao(); // Método da classe faz o trabalho (limpa, salva, atualiza UI)
            alert(`Histórico de ${v.modelo} limpo.`);
        } catch (e) {
            alert('Erro ao tentar limpar o histórico. Verifique o console.');
            console.error("Erro em handleLimparHistorico:", e);
        }
    }
}

/**
 * Handler para o botão de excluir o veículo.
 * @param {string} veiculoId - ID do veículo a ser excluído.
 * @returns {void}
 */
function handleExcluirVeiculo(veiculoId) {
    const v = garagem[veiculoId];
    if (!v) {
         alert(`Erro: Veículo ${veiculoId} não encontrado para exclusão.`);
         return;
    }
    // Confirmação DUPLA é recomendada para exclusão
    if (confirm(`EXCLUIR PERMANENTEMENTE o veículo "${v.modelo}" (${v.placa || 'S/P'})?\n\nTODOS OS DADOS (incluindo histórico) SERÃO PERDIDOS.\n\nEsta ação NÃO pode ser desfeita!`)) {
        // Segunda confirmação opcional, mas boa ideia
        // if (prompt(`Para confirmar, digite o modelo do veículo: "${v.modelo}"`) === v.modelo) {
            const modeloExcluido = v.modelo; // Guarda nome para mensagem final
            try {
                delete garagem[veiculoId]; // Remove da memória
                if (salvarGaragem()) { // Tenta persistir a remoção
                    atualizarInterfaceCompleta(); // Atualiza toda a UI (menu, display, etc.)
                    alert(`"${modeloExcluido}" foi excluído com sucesso.`);
                } else {
                     // Falha ao salvar é crítico aqui. O veículo foi removido da memória mas não do storage.
                     // Informa o usuário sobre a inconsistência.
                     console.error("Falha CRÍTICA: Veículo removido da memória, mas erro ao salvar a remoção no LocalStorage.");
                     alert("ERRO GRAVE: Não foi possível salvar a exclusão do veículo no armazenamento. O veículo pode reaparecer ao recarregar a página. Recomenda-se recarregar.");
                     // Poderia tentar recarregar a garagem para sincronizar, mas pode ser confuso.
                     // carregarGaragem();
                }
            } catch (e) {
                alert("Erro inesperado ao tentar excluir o veículo. Verifique o console.");
                console.error("Erro em handleExcluirVeiculo:", e);
                // Se deu erro aqui, é provável que o veículo ainda esteja em 'garagem'.
                // Tentar recarregar pode ser a melhor opção.
            }
        // } else {
        //     alert("Exclusão cancelada (modelo não confirmado).");
        // }
    }
}


// ==================================================
//      ALERTAS E VISUALIZAÇÕES GERAIS
// ==================================================

/**
 * Atualiza a lista global de agendamentos futuros.
 * @returns {void}
 */
function atualizarExibicaoAgendamentosFuturos() {
    const divLista = document.getElementById('agendamentos-futuros-lista');
    if (!divLista) return;

    const agora = new Date();
    let todosAgendamentos = [];

    // Coleta agendamentos futuros de todos os veículos
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data) && m.data > agora) // Filtra válidos e futuros
            .forEach(m => todosAgendamentos.push({ manutencao: m, veiculoModelo: v.modelo, veiculoId: v.id })); // Guarda info relevante
    });

    // Ordena pela data (mais próximos primeiro)
    todosAgendamentos.sort((a, b) => a.manutencao.data.getTime() - b.manutencao.data.getTime());

    // Monta o HTML da lista
    if (todosAgendamentos.length > 0) {
        const listaHtml = todosAgendamentos.map(item =>
            // Adiciona data-attribute para tornar clicável e selecionar o veículo
            `<li title="Clique para ver ${item.veiculoModelo}" data-link-veiculo="${item.veiculoId}">
               <strong>${item.veiculoModelo}:</strong> ${item.manutencao.formatarComHora()}
             </li>`
        ).join('');
        divLista.innerHTML = `<ul>${listaHtml}</ul>`;

        // Adiciona listener para os links (usando delegação de eventos no UL)
        divLista.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);

    } else {
        divLista.innerHTML = '<p>Nenhum agendamento futuro encontrado.</p>';
    }
}

/**
 * Verifica manutenções para hoje/amanhã e exibe notificações.
 * @returns {void}
 */
function verificarAgendamentosProximos() {
    const areaNotif = document.getElementById('notificacoes-area');
    if (!areaNotif) return;

    const agora = new Date();
    const inicioHoje = new Date(agora); inicioHoje.setHours(0, 0, 0, 0);
    const fimDeAmanha = new Date(agora);
    fimDeAmanha.setDate(agora.getDate() + 1);
    fimDeAmanha.setHours(23, 59, 59, 999);

    let notificacoes = [];

    // Coleta agendamentos de hoje e amanhã
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data) &&
                          m.data >= inicioHoje && m.data <= fimDeAmanha) // Filtra hoje e amanhã
            .forEach(m => {
                const ehHoje = m.data.toDateString() === agora.toDateString();
                const prefixo = ehHoje ? "🚨 HOJE" : "🗓️ Amanhã";
                const horaFormatada = m.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                // Adiciona link para o veículo
                notificacoes.push({
                    html: `<li title="Clique para ver ${v.modelo}" data-link-veiculo="${v.id}">${prefixo}: <strong>${v.modelo}</strong> - ${m.tipo} às ${horaFormatada}</li>`,
                    ehHoje: ehHoje,
                    data: m.data // Guarda data para ordenação secundária
                });
            });
    });

    // Ordena: Hoje primeiro, depois por hora
    notificacoes.sort((a, b) => {
        if (a.ehHoje !== b.ehHoje) return a.ehHoje ? -1 : 1; // Hoje antes de amanhã
        return a.data.getTime() - b.data.getTime(); // Ordena por hora
    });

    // Exibe na UI
    if (notificacoes.length > 0) {
        areaNotif.innerHTML = `<h4><i class="fa-solid fa-bell fa-shake" style="color: #ffc107;"></i> Alertas Manutenção Próxima</h4><ul>${notificacoes.map(n => n.html).join('')}</ul>`;
        areaNotif.style.display = 'block';
        // Adiciona listener para os links (delegação)
         areaNotif.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);
    } else {
        areaNotif.innerHTML = ''; // Limpa completamente se vazio
        areaNotif.style.display = 'none'; // Esconde a área
    }
}


/**
 * Verifica CNHs vencidas ou próximas do vencimento.
 * @returns {void}
 */
function verificarVencimentoCNH() {
    const areaCnh = document.getElementById('cnh-alertas-area');
    if (!areaCnh) return;

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); // Zera hora para comparar só data
    let alertasCnh = [];

    // Coleta CNHs problemáticas
    Object.values(garagem).forEach(v => {
        if (v.dataVencimentoCNH instanceof Date && !isNaN(v.dataVencimentoCNH.getTime())) {
            const dataVenc = v.dataVencimentoCNH;
            // Calcula diferença em dias (arredondando para cima)
            const diffTime = dataVenc.getTime() - hoje.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const dataFormatada = dataVenc.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // Usa UTC para exibir data correta

            let statusHtml = '';
            let prioridade = 3; // 1=Vencida, 2=Breve, 3=OK

            if (diffDays < 0) {
                statusHtml = `<span class="cnh-status cnh-vencida">VENCIDA (${dataFormatada})!</span>`;
                prioridade = 1;
            } else if (diffDays <= 30) {
                statusHtml = `<span class="cnh-status cnh-vence-breve">Vence em ${diffDays}d (${dataFormatada})!</span>`;
                prioridade = 2;
            }

            if (statusHtml) { // Só adiciona se tiver alerta
                alertasCnh.push({
                    html: `<li title="Clique para ver ${v.modelo}" data-link-veiculo="${v.id}"><strong>${v.modelo} (${v.placa || 'S/P'}):</strong> CNH ${statusHtml}</li>`,
                    prioridade: prioridade,
                    diffDays: diffDays // Para ordenação secundária
                });
            }
        }
    });

    // Ordena: Vencidas primeiro, depois as que vencem em breve (mais próximas primeiro)
    alertasCnh.sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade; // Ordena por prioridade (1, 2)
        return a.diffDays - b.diffDays; // Dentro da mesma prioridade, ordena por dias restantes
    });

    // Exibe na UI
    if (alertasCnh.length > 0) {
        areaCnh.innerHTML = `<h4><i class="fa-solid fa-id-card-clip"></i> Alertas de CNH</h4><ul>${alertasCnh.map(a => a.html).join('')}</ul>`;
        areaCnh.style.display = 'block';
        // Adiciona listener para os links (delegação)
         areaCnh.querySelector('ul')?.addEventListener('click', handleCliqueLinkVeiculo);
    } else {
        areaCnh.innerHTML = ''; // Limpa
        areaCnh.style.display = 'none'; // Esconde
    }
}

/**
 * Handler genérico para cliques em links de veículo nas áreas de alerta/agendamento.
 * Usa delegação de eventos.
 * @param {Event} event - O objeto do evento click.
 */
function handleCliqueLinkVeiculo(event) {
    const targetLi = event.target.closest('li[data-link-veiculo]'); // Encontra o LI pai com o data-attribute
    if (targetLi) {
        const veiculoId = targetLi.dataset.linkVeiculo;
        if (garagem[veiculoId]) {
            console.log(`Link clicado para veículo ID: ${veiculoId}`);
            handleTrocarAba('tab-garagem'); // Garante que está na aba certa
            marcarBotaoAtivo(veiculoId);
            renderizarVeiculo(veiculoId);
            // Opcional: Scroll suave para a área do veículo
            const displayArea = document.getElementById('veiculo-display-area');
            if(displayArea) displayArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            console.warn(`Link clicado para veículo ID ${veiculoId}, mas veículo não encontrado na garagem.`);
        }
    }
}


// ==================================================
//      BUSCA DADOS EXTERNOS (API SIMULADA)
// ==================================================

/**
 * Busca detalhes extras de um veículo na API simulada (dados_veiculos_api.json).
 * @param {string} identificadorVeiculo - O ID do veículo a ser buscado.
 * @returns {Promise<object|null>} Uma Promise que resolve com o objeto de detalhes
 *                                  ou `null` se não encontrado ou em caso de erro.
 */
async function buscarDetalhesVeiculoAPI(identificadorVeiculo) {
    console.log(`Buscando detalhes para ID: ${identificadorVeiculo} na API simulada...`);
    const caminhoAPI = './dados_veiculos_api.json'; // Caminho relativo para o arquivo local

    try {
        // Faz a requisição usando fetch
        const response = await fetch(caminhoAPI);

        // Verifica se a requisição foi bem-sucedida (status 2xx)
        if (!response.ok) {
            // Se o status não for OK (ex: 404 Not Found), loga e retorna null
            console.error(`Erro HTTP ao buscar API simulada (${caminhoAPI}): ${response.status} ${response.statusText}`);
            return null;
        }

        // Tenta converter a resposta para JSON
        const dadosTodosVeiculos = await response.json();

        // Verifica se o resultado é um array (esperado do JSON)
        if (!Array.isArray(dadosTodosVeiculos)) {
             console.error(`Erro: O arquivo ${caminhoAPI} não contém um array JSON válido.`);
             return null;
        }

        // Encontra o veículo específico dentro do array pelo ID fornecido
        // Garante que a busca seja feita corretamente (ex: case-sensitive)
        const detalhes = dadosTodosVeiculos.find(veiculo => veiculo && veiculo.id === identificadorVeiculo);

        if (detalhes) {
            console.log(`Detalhes encontrados para ${identificadorVeiculo}:`, detalhes);
            return detalhes; // Retorna o objeto de detalhes encontrado
        } else {
            console.log(`Nenhum detalhe encontrado para ${identificadorVeiculo} em ${caminhoAPI}.`);
            return null; // Retorna null se o ID não foi encontrado no array
        }

    } catch (error) {
        // Captura erros de rede (fetch falhou completamente, ex: CORS se fosse URL externa)
        // ou erros de parsing (JSON inválido)
        console.error(`Erro ao buscar ou processar dados da API simulada (${caminhoAPI}):`, error);
        return null; // Retorna null em caso de qualquer erro na execução do try
    }
}


// ==================================================
//                   INICIALIZAÇÃO DA APLICAÇÃO
// ==================================================

/**
 * Ponto de entrada principal da aplicação.
 * @returns {void}
 */
function inicializarAplicacao() {
    console.log(`DOM Carregado. Iniciando Garagem Inteligente (Key: ${GARAGEM_KEY})...`);
    try {
        setupEventListeners(); // Configura listeners globais primeiro
        carregarGaragem();     // Carrega dados ou inicializa padrão (e atualiza UI)
        console.log("Aplicação inicializada com sucesso.");
    } catch (e) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO:", e);
        // Mostra mensagem de erro grave para o usuário
        document.body.innerHTML = `<div style='color:red; border: 2px solid red; background: #ffebee; padding: 20px; font-family: sans-serif; text-align: center;'>
            <h1><i class="fa-solid fa-skull-crossbones"></i> Erro Grave na Inicialização</h1>
            <p>A aplicação encontrou um problema crítico e não pôde ser iniciada.</p>
            <p>Isso pode ser causado por dados corrompidos ou um erro inesperado no código.</p>
            <p><strong>Detalhes do Erro (para debug):</strong> ${e.message}</p>
            <p><strong>Ações Recomendadas:</strong></p>
            <ol style="text-align: left; display: inline-block;">
                <li>Verifique o console do navegador (F12) para mais detalhes técnicos.</li>
                <li>Tente limpar os dados da aplicação e recarregar. <strong>Atenção: Isso apagará sua garagem salva!</strong></li>
            </ol>
            <br>
            <button onclick='localStorage.removeItem("${GARAGEM_KEY}"); location.reload();' style="padding: 10px 15px; background: #f44336; color: white; border: none; cursor: pointer; border-radius: 4px;">
                <i class="fa-solid fa-bomb"></i> Limpar Dados e Recarregar
            </button>
        </div>`;
    }
}

/**
 * Configura os event listeners globais (abas, forms, etc.).
 * @returns {void}
 */
function setupEventListeners() {
    console.log("Configurando Listeners Iniciais...");

    // Abas de Navegação
    document.getElementById('tab-garagem')?.addEventListener('click', () => handleTrocarAba('tab-garagem'));
    document.getElementById('tab-adicionar')?.addEventListener('click', () => handleTrocarAba('tab-adicionar'));

    // Submit do Formulário de Adicionar Veículo
    document.getElementById('form-add-veiculo')?.addEventListener('submit', handleAdicionarVeiculo);

    // Mostrar/Esconder Capacidade de Carga no Form de Adicionar
    const tipoSelect = document.getElementById('add-tipo');
    const cargaContainer = document.getElementById('add-capacidade-carga-container');
    if (tipoSelect && cargaContainer) {
        const toggleCargaVisibility = () => {
             cargaContainer.style.display = tipoSelect.value === 'Caminhao' ? 'block' : 'none';
             // Opcional: Limpar valor de capacidade se mudar de Caminhão para outro tipo
             if (tipoSelect.value !== 'Caminhao') {
                const capInput = cargaContainer.querySelector('#add-capacidade-carga');
                if(capInput) capInput.value = '';
             }
         };
        tipoSelect.addEventListener('change', toggleCargaVisibility);
        toggleCargaVisibility(); // Garante estado inicial correto ao carregar
    }

    // Preview da Imagem no Formulário de Adicionar
    const addImagemInput = document.getElementById('add-imagem-input');
    const addImagemPreview = document.getElementById('add-imagem-preview');
    if (addImagemInput && addImagemPreview) {
        addImagemInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith("image/")) {
                 // Usa FileReader para Base64 (consistente com o salvamento)
                const reader = new FileReader();
                reader.onload = (e) => {
                     addImagemPreview.src = e.target.result;
                     addImagemPreview.style.display = 'block'; // Mostra a imagem
                }
                 reader.onerror = () => { // Limpa em caso de erro de leitura
                     addImagemPreview.src = '#';
                     addImagemPreview.style.display = 'none';
                     console.error("Erro ao ler imagem para preview (adição).");
                 }
                reader.readAsDataURL(file);
            } else {
                // Limpa preview se nenhum arquivo ou arquivo inválido for selecionado
                addImagemPreview.src = '#';
                addImagemPreview.style.display = 'none';
            }
        });
    }
    console.log("Listeners Iniciais configurados.");
}

// --- Gatilho Inicial ---
// Espera o DOM estar completamente carregado para iniciar a aplicação.
document.addEventListener('DOMContentLoaded', inicializarAplicacao);