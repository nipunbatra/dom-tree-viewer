const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const treeContainer = document.getElementById('treeContainer');
const statsContainer = document.getElementById('statsContainer');
const bs4Code = document.getElementById('bs4Code');
const copyBtn = document.getElementById('copyBtn');
const statusDiv = document.getElementById('status');
const showAttrsCheckbox = document.getElementById('showAttrs');
const showTextCheckbox = document.getElementById('showText');
const expandAllCheckbox = document.getElementById('expandAll');

let currentDomData = null;
let selectedNode = null;
let currentUrl = '';

fetchBtn.addEventListener('click', fetchAndParse);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchAndParse();
});
copyBtn.addEventListener('click', copyCode);

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

    currentUrl = url;
    showLoading('Fetching and parsing...');

    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    let html = null;
    let lastError = null;

    for (const proxyUrl of proxies) {
        try {
            showLoading('Trying proxy...');
            const response = await fetch(proxyUrl);
            if (response.ok) {
                html = await response.text();
                if (html && html.length > 0) break;
            }
        } catch (error) {
            lastError = error;
            continue;
        }
    }

    if (!html) {
        showError('Failed to fetch URL. The site may block CORS proxies.');
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        currentDomData = analyzeDOM(doc);
        selectedNode = null;
        renderTree(currentDomData.tree);
        renderStats(currentDomData.stats);
        renderBs4Code(null);
        statusDiv.style.display = 'none';
    } catch (error) {
        showError('Error parsing HTML: ' + error.message);
    }
}

function analyzeDOM(doc) {
    const stats = { tagCounts: {}, totalElements: 0, maxDepth: 0 };
    const tree = buildTreeNode(doc.documentElement, 0, stats, []);
    return { tree, stats };
}

function buildTreeNode(element, depth, stats, path) {
    stats.totalElements++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    const tagName = element.tagName.toLowerCase();
    stats.tagCounts[tagName] = (stats.tagCounts[tagName] || 0) + 1;

    const node = {
        tag: tagName,
        attributes: {},
        text: '',
        children: [],
        path: [...path, { tag: tagName, attributes: {} }]
    };

    for (const attr of element.attributes) {
        node.attributes[attr.name] = attr.value;
        node.path[node.path.length - 1].attributes[attr.name] = attr.value;
    }

    for (const child of element.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            node.children.push(buildTreeNode(child, depth + 1, stats, node.path));
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
    nodeDiv.dataset.path = JSON.stringify(nodeData.path);

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

        header.addEventListener('click', (e) => {
            childrenDiv.classList.toggle('expanded');
            toggle.textContent = childrenDiv.classList.contains('expanded') ? '▼' : '▶';
            e.stopPropagation();
        });
    }

    header.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(header, nodeData.path);
    });

    return nodeDiv;
}

function selectNode(header, path) {
    document.querySelectorAll('.node-header.selected').forEach(el => {
        el.classList.remove('selected');
    });
    header.classList.add('selected');
    selectedNode = path;
    renderBs4Code(path);
}

function renderBs4Code(path) {
    if (!path) {
        bs4Code.innerHTML = '<code>Select an element to generate Beautiful Soup code</code>';
        return;
    }

    const code = generateBs4Code(path);
    bs4Code.innerHTML = `<code>${escapeHtml(code)}</code>`;
}

function generateBs4Code(path) {
    let code = `import requests\nfrom bs4 import BeautifulSoup\n\n`;
    code += `# Fetch the page\n`;
    code += `url = "${currentUrl}"\n`;
    code += `response = requests.get(url)\n`;
    code += `soup = BeautifulSoup(response.content, 'html.parser')\n\n`;
    code += `# Select the element\n`;

    const selectors = generateSelectors(path);
    code += `# Option 1: CSS Selector\n`;
    code += `element = soup.select_one("${selectors.css}")\n\n`;
    code += `# Option 2: Find methods\n`;
    code += selectors.find + `\n\n`;
    code += `# Get text content\n`;
    code += `if element:\n`;
    code += `    print(element.get_text(strip=True))\n`;
    code += `    # Or get specific attribute\n`;
    code += `    # print(element.get('href'))\n`;

    return code;
}

function generateSelectors(path) {
    const usefulPath = path.filter(p => p.tag !== 'html' && p.tag !== 'body');

    if (usefulPath.length === 0) {
        return {
            css: 'body',
            find: 'element = soup.find("body")'
        };
    }

    const last = usefulPath[usefulPath.length - 1];

    // Build CSS selector with class and id
    let cssSelector = usefulPath.map(p => {
        let sel = p.tag;
        if (p.attributes.id) {
            sel += `#${p.attributes.id.replace(/"/g, '')}`;
        }
        if (p.attributes.class) {
            const classes = p.attributes.class.split(/\s+/).filter(c => c);
            if (classes.length > 0) {
                sel += `.${classes.join('.')}`;
            }
        }
        return sel;
    }).join(' > ');

    // Build find() approach
    let findCode = `element = soup`;
    for (const p of usefulPath) {
        let findCall = '';
        if (p.attributes.id) {
            findCall = `.find("${p.tag}", id="${p.attributes.id.replace(/"/g, '')}")`;
        } else if (p.attributes.class) {
            const classes = p.attributes.class.split(/\s+/).filter(c => c);
            if (classes.length === 1) {
                findCall = `.find("${p.tag}", class_="${classes[0]}")`;
            } else {
                findCall = `.find("${p.tag}", class_=["${classes.join('", "')}"])`;
            }
        } else {
            findCall = `.find("${p.tag}")`;
        }
        findCode += findCall;
    }

    return {
        css: cssSelector,
        find: findCode
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyCode() {
    const code = bs4Code.textContent;
    navigator.clipboard.writeText(code).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
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
