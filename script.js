const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const treeContainer = document.getElementById('treeContainer');
const statsContainer = document.getElementById('statsContainer');
const statusDiv = document.getElementById('status');
const showAttrsCheckbox = document.getElementById('showAttrs');
const showTextCheckbox = document.getElementById('showText');
const expandAllCheckbox = document.getElementById('expandAll');

let currentDomData = null;

fetchBtn.addEventListener('click', fetchAndParse);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchAndParse();
});

async function fetchAndParse() {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please enter a URL');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showError('URL must start with http:// or https://');
        return;
    }

    showLoading('Fetching and parsing...');

    try {
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        currentDomData = analyzeDOM(doc);
        renderTree(currentDomData.tree);
        renderStats(currentDomData.stats);
        statusDiv.style.display = 'none';
    } catch (error) {
        showError('Error: ' + error.message);
    }
}

function analyzeDOM(doc) {
    const stats = { tagCounts: {}, totalElements: 0, maxDepth: 0 };
    const tree = buildTreeNode(doc.documentElement, 0, stats);
    return { tree, stats };
}

function buildTreeNode(element, depth, stats) {
    stats.totalElements++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    const tagName = element.tagName.toLowerCase();
    stats.tagCounts[tagName] = (stats.tagCounts[tagName] || 0) + 1;

    const node = {
        tag: tagName,
        attributes: {},
        text: '',
        children: []
    };

    for (const attr of element.attributes) {
        node.attributes[attr.name] = attr.value;
    }

    for (const child of element.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            node.children.push(buildTreeNode(child, depth + 1, stats));
        } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            const text = child.textContent.trim().slice(0, 50);
            if (text) node.text += (node.text ? ' ' : '') + text;
        }
    }

    return node;
}

function renderTree(treeData) {
    treeContainer.innerHTML = '';
    const treeElement = createTreeNode(treeData, 0);
    treeElement.classList.add('tree-node-root');
    treeContainer.appendChild(treeElement);
}

function createTreeNode(nodeData, depth) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';

    const header = document.createElement('div');
    header.className = 'node-header';

    const toggle = document.createElement('span');
    toggle.className = 'node-toggle';
    toggle.textContent = nodeData.children.length > 0 ? (expandAllCheckbox.checked ? '▼' : '▶') : '·';
    header.appendChild(toggle);

    const tag = document.createElement('span');
    tag.className = 'node-tag';
    tag.textContent = `<${nodeData.tag}>`;
    header.appendChild(tag);

    if (showAttrsCheckbox.checked && Object.keys(nodeData.attributes).length > 0) {
        const attrs = document.createElement('span');
        attrs.className = 'node-attrs';
        const attrStr = Object.entries(nodeData.attributes)
            .slice(0, 3)
            .map(([k, v]) => `${k}="${v.slice(0, 15)}${v.length > 15 ? '...' : ''}"`)
            .join(' ');
        attrs.textContent = ' ' + attrStr;
        header.appendChild(attrs);
    }

    if (showTextCheckbox.checked && nodeData.text) {
        const text = document.createElement('span');
        text.className = 'node-text';
        text.textContent = ` "${nodeData.text}"`;
        header.appendChild(text);
    }

    nodeDiv.appendChild(header);

    if (nodeData.children.length > 0) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'node-children';
        if (expandAllCheckbox.checked) childrenDiv.classList.add('expanded');

        nodeData.children.forEach(child => {
            childrenDiv.appendChild(createTreeNode(child, depth + 1));
        });

        nodeDiv.appendChild(childrenDiv);

        header.addEventListener('click', () => {
            childrenDiv.classList.toggle('expanded');
            toggle.textContent = childrenDiv.classList.contains('expanded') ? '▼' : '▶';
        });
    }

    return nodeDiv;
}

function renderStats(stats) {
    const totalElements = stats.totalElements;
    const uniqueTags = Object.keys(stats.tagCounts).length;
    const maxDepth = stats.maxDepth;

    const sortedTags = Object.entries(stats.tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    const maxCount = sortedTags[0]?.[1] || 1;

    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Total Elements</span>
            <span class="stat-value">${totalElements.toLocaleString()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Unique Tags</span>
            <span class="stat-value">${uniqueTags}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Max Depth</span>
            <span class="stat-value">${maxDepth}</span>
        </div>
        <div id="tagChart">
            <h3 style="margin-bottom: 10px; font-size: 14px; color: #555;">Top Elements</h3>
            ${sortedTags.map(([tag, count]) => {
                const percentage = (count / maxCount) * 100;
                return `
                    <div class="bar-item">
                        <span class="bar-label">${tag}</span>
                        <div class="bar-wrapper">
                            <div class="bar-fill" style="width: ${percentage}%">
                                <span class="bar-value">${count}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showLoading(message) {
    statusDiv.className = 'loading';
    statusDiv.textContent = message;
}

function showError(message) {
    statusDiv.className = 'error';
    statusDiv.textContent = message;
}

showAttrsCheckbox.addEventListener('change', () => {
    if (currentDomData) renderTree(currentDomData.tree);
});

showTextCheckbox.addEventListener('change', () => {
    if (currentDomData) renderTree(currentDomData.tree);
});

expandAllCheckbox.addEventListener('change', () => {
    if (currentDomData) renderTree(currentDomData.tree);
});
