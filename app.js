const BUDGET = 15000;
const TAXA_CONVERSAO = 5.4;
let allProducts = [];
let allRoupas = [];
let allDicas = [];
let trash = [];
let editingProductId = null;
let roupasData = {};

async function loadData() {
    try {
        const responses = await Promise.all([
            fetch('data.json').catch(() => null),
            fetch('roupas_por_idade.json').catch(() => null),
            fetch('dicas.json').catch(() => null)
        ]);

        if (responses[0]) {
            const productsData = await responses[0].json();
            allProducts = [];
            Object.entries(productsData).forEach(([categoria, produtos]) => {
                produtos.forEach(p => {
                    allProducts.push({
                        ...p,
                        categoria,
                        comprado: localStorage.getItem(`produto-${p.id}`) === 'true'
                    });
                });
            });
        }

        if (responses[1]) {
            allRoupas = await responses[1].json();
            initializeRoupasData();
        }

        if (responses[2]) {
            allDicas = await responses[2].json();
        }

        trash = JSON.parse(localStorage.getItem('trash') || '[]');
        populateCategories();
        renderProducts();
        renderRoupas();
        renderDicas();
        updateBudget();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

function initializeRoupasData() {
    allRoupas.forEach((roupa, idx) => {
        const key = `roupa-${idx}`;
        if (!localStorage.getItem(key)) {
            roupasData[key] = {
                tipo_peca: roupa.tipo_peca,
                rn_0_3_5kg: { qtde: 0, preco: 0 },
                '0_3_meses': { qtde: 0, preco: 0 },
                '3_6_meses': { qtde: 0, preco: 0 },
                '6_12_meses': { qtde: 0, preco: 0 },
                '12_meses': { qtde: 0, preco: 0 }
            };
        } else {
            roupasData[key] = JSON.parse(localStorage.getItem(key));
        }
    });
}

function populateCategories() {
    const categories = new Set();
    allProducts.forEach(p => categories.add(p.categoria));
    const select = document.getElementById('addProductCategory');
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    Array.from(categories).sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    const sorted = [...allProducts].sort((a, b) => {
        const priorityOrder = { 'Alta': 1, 'Moderada': 2, 'Baixa': 3 };
        return (priorityOrder[a.prioridade] || 999) - (priorityOrder[b.prioridade] || 999);
    });

    const grouped = {};
    sorted.forEach(p => {
        if (!grouped[p.categoria]) grouped[p.categoria] = [];
        grouped[p.categoria].push(p);
    });

    let html = '';
    Object.entries(grouped).forEach(([categoria, produtos]) => {
        html += `<h3 style="color: #ff6b9d; margin: 20px 0 15px 0; font-size: 16px;">📦 ${categoria}</h3>`;
        html += '<div class="products-grid">';
        produtos.forEach(p => {
            const preco_brl = (p.preco_usd * TAXA_CONVERSAO).toFixed(0);
            const prioridadeClass = p.prioridade.toLowerCase();
            html += `<div class="product-card"><div class="product-name">${p.produto}</div><div class="product-brand">${p.marca}</div><div class="product-meta"><span class="meta-tag">${p.loja_sugerida || 'N/A'}</span><span class="meta-tag ${prioridadeClass}">${p.prioridade}</span></div><div class="product-price" onclick="openPriceModal('${p.id}', '${p.produto.replace(/'/g, "\\'")}', ${p.preco_usd})">$${p.preco_usd.toFixed(2)} / R$ ${preco_brl}</div><div class="product-actions"><a href="${p.link}" target="_blank" class="btn btn-buy">🔗 Comprar</a><button class="btn btn-toggle" onclick="toggleProduct('${p.id}')">${p.comprado ? '✓' : '□'}</button><button class="btn btn-delete" onclick="deleteProduct('${p.id}')">🗑️</button></div></div>`;
        });
        html += '</div>';
    });

    container.innerHTML = html || '<div class="empty-state">Nenhum produto</div>';
}

function renderRoupas() {
    const container = document.getElementById('roupasContainer');
    let html = '';
    let totalSpent = 0;
    let totalPieces = 0;

    const idades = [
        { key: 'rn_0_3_5kg', label: 'RN (0-3,5kg)' },
        { key: '0_3_meses', label: '0-3 Meses' },
        { key: '3_6_meses', label: '3-6 Meses' },
        { key: '6_12_meses', label: '6-12 Meses' },
        { key: '12_meses', label: '12+ Meses' }
    ];

    allRoupas.forEach((roupa, idx) => {
        const key = `roupa-${idx}`;
        const data = roupasData[key] || {
            rn_0_3_5kg: { qtde: 0, preco: 0 },
            '0_3_meses': { qtde: 0, preco: 0 },
            '3_6_meses': { qtde: 0, preco: 0 },
            '6_12_meses': { qtde: 0, preco: 0 },
            '12_meses': { qtde: 0, preco: 0 }
        };

        let cardTotal = 0;
        let cardPieces = 0;

        html += '<div class="roupa-card">';
        html += `<div class="roupa-title">${roupa.tipo_peca}</div>`;
        
        if (roupa.qtde_sugeridas) {
            html += `<div class="roupa-sugestao">💡 Sugestão: ${roupa.qtde_sugeridas}</div>`;
        }
        
        if (roupa.comentario) {
            html += `<div class="roupa-comentario">📝 ${roupa.comentario}</div>`;
        }

        idades.forEach(idade => {
            const qtdeRecomendada = roupa[idade.key];
            
            if (qtdeRecomendada === null || qtdeRecomendada === undefined) {
                return;
            }

            const qtde = data[idade.key].qtde || 0;
            const preco = data[idade.key].preco || 0;
            const subtotal = qtde * preco * TAXA_CONVERSAO;
            cardTotal += subtotal;
            cardPieces += qtde;

            html += `<div class="roupa-idade-item">
                <label class="roupa-idade-label">${idade.label}</label>
                <span class="roupa-recomendado">📌 Recomendado: ${qtdeRecomendada} peça${qtdeRecomendada !== 1 ? 's' : ''}</span>
                <div class="roupa-input-group">
                    <input type="number" class="roupa-input" placeholder="Qtde comprada" min="0" value="${qtde}" onchange="updateRoupasData(${idx}, '${idade.key}', 'qtde', this.value)">
                    <input type="number" class="roupa-input" placeholder="Preço (R$)" step="0.01" min="0" value="${preco}" onchange="updateRoupasData(${idx}, '${idade.key}', 'preco', this.value)">
                </div>
                <div class="roupa-total">
                    <span class="roupa-total-label">Subtotal:</span>
                    <span class="roupa-total-value">R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
            </div>`;
        });

        html += `<div style="background: #fff0f5; padding: 10px; border-radius: 6px; margin-top: 10px; text-align: right; font-weight: bold; color: #ff6b9d;">Total: R$ ${cardTotal.toFixed(2).replace('.', ',')} (${cardPieces} peças)</div>`;
        html += '</div>';

        totalSpent += cardTotal;
        totalPieces += cardPieces;
    });

    container.innerHTML = html || '<div class="empty-state">Nenhuma roupa registrada</div>';
    
    document.getElementById('roupasTotalSpent').textContent = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;
    document.getElementById('roupasTotalPieces').textContent = totalPieces;
}

function updateRoupasData(idx, idade, field, value) {
    const key = `roupa-${idx}`;
    if (!roupasData[key]) {
        roupasData[key] = {
            rn_0_3_5kg: { qtde: 0, preco: 0 },
            '0_3_meses': { qtde: 0, preco: 0 },
            '3_6_meses': { qtde: 0, preco: 0 },
            '6_12_meses': { qtde: 0, preco: 0 },
            '12_meses': { qtde: 0, preco: 0 }
        };
    }
    roupasData[key][idade][field] = parseFloat(value) || 0;
    localStorage.setItem(key, JSON.stringify(roupasData[key]));
    renderRoupas();
}

function renderDicas() {
    const container = document.getElementById('dicasContainer');
    let html = '';

    allDicas.forEach(dica => {
        html += `<div class="dica-card"><div class="dica-emoji">${dica.emoji}</div><div class="dica-content"><h3>${dica.titulo}</h3><p>${dica.descricao}</p></div></div>`;
    });

    container.innerHTML = html;
}

function toggleProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (product) {
        product.comprado = !product.comprado;
        localStorage.setItem(`produto-${id}`, product.comprado);
        renderProducts();
        updateBudget();
    }
}

function deleteProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (product) {
        trash.push({
            id,
            produto: product.produto,
            categoria: product.categoria,
            preco: product.preco_usd,
            data: new Date().toLocaleString('pt-BR')
        });
        localStorage.setItem('trash', JSON.stringify(trash));
        allProducts = allProducts.filter(p => p.id !== id);
        renderProducts();
        updateBudget();
    }
}

function openPriceModal(id, name, price) {
    editingProductId = id;
    document.getElementById('modalProductName').textContent = name;
    document.getElementById('modalPrice').value = price;
    document.getElementById('priceModal').classList.add('active');
}

function closePriceModal() {
    document.getElementById('priceModal').classList.remove('active');
    editingProductId = null;
}

function savePriceEdit() {
    if (editingProductId) {
        const newPrice = parseFloat(document.getElementById('modalPrice').value);
        const product = allProducts.find(p => p.id === editingProductId);
        if (product && newPrice >= 0) {
            product.preco_usd = newPrice;
            product.preco_brl = newPrice * TAXA_CONVERSAO;
            renderProducts();
            updateBudget();
            closePriceModal();
        }
    }
}

function openAddProductModal() {
    document.getElementById('addProductModal').classList.add('active');
}

function closeAddProductModal() {
    document.getElementById('addProductModal').classList.remove('active');
}

function saveNewProduct() {
    const categoria = document.getElementById('addProductCategory').value;
    const nome = document.getElementById('addProductName').value;
    const marca = document.getElementById('addProductBrand').value;
    const preco = parseFloat(document.getElementById('addProductPrice').value);
    const prioridade = document.getElementById('addProductPriority').value;
    const link = document.getElementById('addProductLink').value;

    if (categoria && nome && preco >= 0) {
        const newProduct = {
            id: `custom-${Date.now()}`,
            produto: nome,
            marca: marca || 'N/A',
            preco_usd: preco,
            preco_brl: preco * TAXA_CONVERSAO,
            categoria,
            prioridade,
            link: link || '#',
            loja_sugerida: 'Customizado',
            comprado: false
        };
        allProducts.push(newProduct);
        renderProducts();
        updateBudget();
        closeAddProductModal();
        document.getElementById('addProductName').value = '';
        document.getElementById('addProductBrand').value = '';
        document.getElementById('addProductPrice').value = '';
        document.getElementById('addProductLink').value = '';
    }
}

function updateBudget() {
    const comprados = allProducts.filter(p => p.comprado);
    const total = comprados.reduce((sum, p) => sum + p.preco_usd, 0) * TAXA_CONVERSAO;
    const remaining = BUDGET - total;
    const percent = (total / BUDGET * 100).toFixed(1);

    document.getElementById('totalSpent').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    document.getElementById('remaining').textContent = `R$ ${remaining.toFixed(2).replace('.', ',')}`;
    document.getElementById('percentUsed').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${Math.min(percent, 100)}%`;
}

function renderTrash() {
    const container = document.getElementById('trashContainer');
    if (trash.length === 0) {
        container.innerHTML = '<div class="empty-state">Lixeira vazia</div>';
        return;
    }

    let html = '';
    trash.forEach((item, idx) => {
        html += `<div class="trash-item"><div class="trash-info"><h4>${item.produto}</h4><p>${item.categoria} • ${item.data}</p></div><button class="btn-restore" onclick="restoreProduct(${idx})">Restaurar</button></div>`;
    });
    container.innerHTML = html;
}

function restoreProduct(idx) {
    const item = trash[idx];
    const product = {
        id: item.id,
        produto: item.produto,
        marca: 'Restaurado',
        preco_usd: item.preco,
        preco_brl: item.preco * TAXA_CONVERSAO,
        categoria: item.categoria,
        prioridade: 'Baixa',
        link: '#',
        loja_sugerida: 'N/A',
        comprado: false
    };
    allProducts.push(product);
    trash.splice(idx, 1);
    localStorage.setItem('trash', JSON.stringify(trash));
    renderProducts();
    renderTrash();
}

function switchTab(event, tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'lixeira') renderTrash();
}

loadData();
