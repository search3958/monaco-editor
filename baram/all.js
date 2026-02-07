
// ファイル管理
function addFile(name, content = '', language = null, handle = null, path = '') {
	const id = fileIdCounter++;
	const detectedLang = language || detectLanguage(name);

	files.set(id, {
		id,
		name,
		path: path || name,
		content,
		language: detectedLang,
		modified: false,
		handle: handle
	});

	createEditor(id, content, detectedLang);
	addToFileTree(path || name, id);
	updateFileTree();
	updateTabBar();
	switchToFile(id);

	return id;
}

function addToFileTree(path, fileId) {
	const parts = path.split('/');
	let currentPath = '';

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		currentPath = currentPath ? `${currentPath}/${part}` : part;

		if (!fileTree.has(currentPath)) {
			fileTree.set(currentPath, {
				name: part,
				path: currentPath,
				isFolder: i < parts.length - 1,
				fileId: i === parts.length - 1 ? fileId : null,
				children: []
			});
		}

		if (i > 0) {
			const parentPath = parts.slice(0, i).join('/');
			const parent = fileTree.get(parentPath);
			if (parent && !parent.children.includes(currentPath)) {
				parent.children.push(currentPath);
			}
		}
	}
}

function createEditor(id, content, language) {
	const wrapper = document.createElement('div');
	wrapper.className = 'editor-wrapper';
	wrapper.id = `editor-${id}`;
	document.getElementById('editor-container').appendChild(wrapper);

	// ウェルカム画面を非表示
	const welcome = document.getElementById('welcome-screen');
	if (welcome) welcome.style.display = 'none';

	const editor = monaco.editor.create(wrapper, {
		value: content,
		language: language,
		theme: 'vs-dark',
		automaticLayout: true,
		fontSize: 14,
		tabSize: 4,
		minimap: { enabled: true },
		cursorSmoothCaretAnimation: 'on',
		padding: { top: 10 },
		scrollbar: {
			verticalScrollbarSize: 10,
			horizontalScrollbarSize: 10
		}
	});

	// 変更検知
	editor.onDidChangeModelContent(() => {
		const file = files.get(id);
		if (file && !file.modified) {
			file.modified = true;
			updateFileTree();
			updateTabBar();
		}
	});

	editors.set(id, editor);
}

function switchToFile(id) {
	if (!files.has(id)) return;

	activeFileId = id;
	const file = files.get(id);

	// エディタの表示切替
	document.querySelectorAll('.editor-wrapper').forEach(w => w.classList.remove('active'));
	const wrapper = document.getElementById(`editor-${id}`);
	if (wrapper) wrapper.classList.add('active');

	// タブの更新
	updateTabBar();
	updateFileTree();

	// トップバーのファイル名更新
	document.getElementById('current-file-name').textContent = file.path;
}

function closeFile(id) {
	const file = files.get(id);
	if (file && file.modified) {
		if (!confirm(`${file.name} has unsaved changes. Close anyway?`)) {
			return;
		}
	}

	const editor = editors.get(id);
	if (editor) {
		editor.dispose();
		editors.delete(id);
	}

	const wrapper = document.getElementById(`editor-${id}`);
	if (wrapper) wrapper.remove();

	files.delete(id);
	fileHandles.delete(id);

	if (activeFileId === id) {
		const remainingFiles = Array.from(files.keys());
		if (remainingFiles.length > 0) {
			switchToFile(remainingFiles[0]);
		} else {
			activeFileId = null;
			document.getElementById('current-file-name').textContent = '';
			const welcome = document.getElementById('welcome-screen');
			if (welcome) welcome.style.display = 'flex';
		}
	}

	updateFileTree();
	updateTabBar();
}

// UI更新
function updateFileTree() {
	const tree = document.getElementById('file-tree');
	tree.innerHTML = '';

	// ルートレベルのアイテムを取得
	const rootItems = Array.from(fileTree.values())
		.filter(item => !item.path.includes('/') || item.path.split('/').length === 1)
		.sort((a, b) => {
			if (a.isFolder && !b.isFolder) return -1;
			if (!a.isFolder && b.isFolder) return 1;
			return a.name.localeCompare(b.name);
		});

	rootItems.forEach(item => {
		renderTreeItem(item, tree, 0);
	});

	document.getElementById('file-count').textContent = files.size;
}

function renderTreeItem(item, container, level) {
	const div = document.createElement('div');
	div.className = 'tree-item';

	if (item.fileId !== null && item.fileId === activeFileId) {
		div.classList.add('active-file');
	}

	const file = item.fileId !== null ? files.get(item.fileId) : null;
	if (file && file.modified) {
		div.classList.add('modified');
	}

	const indent = level * 12;

	let html = `<span class="tree-indent" style="width: ${indent}px"></span>`;

	if (item.isFolder) {
		const isExpanded = expandedFolders.has(item.path);
		html += `<span class="tree-arrow ${isExpanded ? 'expanded' : ''}" onclick="toggleFolder('${item.path}')">▶</span>`;
		html += `<span class="tree-icon">📁</span>`;
	} else {
		html += `<span class="tree-arrow empty"></span>`;
		html += `<span class="tree-icon">${getFileIcon(item.name)}</span>`;
	}

	html += `<span class="tree-label">${item.name}</span>`;

	if (!item.isFolder) {
		html += `<span class="tree-actions">`;
		html += `<span class="tree-action" onclick="event.stopPropagation(); closeFile(${item.fileId})" title="Close">×</span>`;
		html += `</span>`;
	}

	div.innerHTML = html;

	if (!item.isFolder) {
		div.onclick = () => switchToFile(item.fileId);
	} else {
		div.onclick = () => toggleFolder(item.path);
	}

	container.appendChild(div);

	// 子要素を表示（フォルダが展開されている場合）
	if (item.isFolder && expandedFolders.has(item.path)) {
		const children = item.children
			.map(childPath => fileTree.get(childPath))
			.filter(Boolean)
			.sort((a, b) => {
				if (a.isFolder && !b.isFolder) return -1;
				if (!a.isFolder && b.isFolder) return 1;
				return a.name.localeCompare(b.name);
			});

		children.forEach(child => {
			renderTreeItem(child, container, level + 1);
		});
	}
}

function toggleFolder(path) {
	if (expandedFolders.has(path)) {
		expandedFolders.delete(path);
	} else {
		expandedFolders.add(path);
	}
	updateFileTree();
}

function updateTabBar() {
	const tabBar = document.getElementById('tab-bar');
	tabBar.innerHTML = '';

	files.forEach((file, id) => {
		const tab = document.createElement('div');
		tab.className = 'tab';
		if (id === activeFileId) tab.classList.add('active');
		if (file.modified) tab.classList.add('modified');

		tab.innerHTML = `
				<span class="tab-icon">${getFileIcon(file.name)}</span>
				<span class="tab-label">${file.name}</span>
				<span class="tab-close" onclick="event.stopPropagation(); closeFile(${id})">×</span>
			`;
		tab.onclick = () => switchToFile(id);
		tabBar.appendChild(tab);
	});
}

function getFileIcon(filename) {
	const ext = filename.split('.').pop().toLowerCase();
	const icons = {
		'js': '📜', 'ts': '📘', 'jsx': '⚛️', 'tsx': '⚛️',
		'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
		'json': '📋', 'md': '📝', 'py': '🐍', 'java': '☕',
		'cpp': '⚙️', 'c': '⚙️', 'go': '🐹', 'rs': '🦀',
		'php': '🐘', 'rb': '💎', 'xml': '📄', 'yml': '📄',
		'yaml': '📄', 'txt': '📄', 'sh': '🐚', 'vue': '💚'
	};
	return icons[ext] || '📄';
}

function detectLanguage(filename) {
	const ext = filename.split('.').pop().toLowerCase();
	const langMap = {
		'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
		'html': 'html', 'css': 'css', 'scss': 'scss', 'sass': 'sass',
		'json': 'json', 'md': 'markdown', 'py': 'python',
		'java': 'java', 'cpp': 'cpp', 'c': 'c', 'go': 'go',
		'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'xml': 'xml',
		'yml': 'yaml', 'yaml': 'yaml', 'sql': 'sql',
		'sh': 'shell', 'txt': 'plaintext', 'vue': 'html'
	};
	return langMap[ext] || 'plaintext';
}

// ファイル操作
async function openFiles() {
	try {
		const handles = await window.showOpenFilePicker({ multiple: true });
		for (const handle of handles) {
			const file = await handle.getFile();
			const content = await file.text();
			addFile(file.name, content, null, handle);
		}
	} catch (err) {
		if (err.name !== 'AbortError') {
			showNotification('Failed to open files: ' + err.message, 'error');
		}
	}
}

async function openFolder() {
	try {
		const dirHandle = await window.showDirectoryPicker();
		fileTree.clear();
		expandedFolders.clear();
		await readDirectory(dirHandle, '');
		updateFileTree();
	} catch (err) {
		if (err.name !== 'AbortError') {
			showNotification('Failed to open folder: ' + err.message, 'error');
		}
	}
}

async function readDirectory(dirHandle, path) {
	const entries = [];
	for await (const entry of dirHandle.values()) {
		entries.push(entry);
	}

	// フォルダを先に、ファイルを後に処理
	entries.sort((a, b) => {
		if (a.kind === 'directory' && b.kind !== 'directory') return -1;
		if (a.kind !== 'directory' && b.kind === 'directory') return 1;
		return a.name.localeCompare(b.name);
	});

	for (const entry of entries) {
		const fullPath = path ? `${path}/${entry.name}` : entry.name;

		if (entry.kind === 'file') {
			try {
				const file = await entry.getFile();
				const content = await file.text();
				addFile(entry.name, content, null, entry, fullPath);
			} catch (err) {
				console.error(`Failed to read ${fullPath}:`, err);
			}
		} else if (entry.kind === 'directory') {
			await readDirectory(entry, fullPath);
		}
	}
}

async function saveCurrentFile() {
	if (!activeFileId) {
		showNotification('No active file to save', 'error');
		return;
	}

	const file = files.get(activeFileId);
	const editor = editors.get(activeFileId);
	const content = editor.getValue();

	try {
		const handle = file.handle;

		if (handle) {
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
		} else {
			const newHandle = await window.showSaveFilePicker({
				suggestedName: file.name
			});
			const writable = await newHandle.createWritable();
			await writable.write(content);
			await writable.close();
			file.handle = newHandle;
		}

		file.content = content;
		file.modified = false;
		updateFileTree();
		updateTabBar();

		showNotification('File saved successfully!');
	} catch (err) {
		if (err.name !== 'AbortError') {
			showNotification('Failed to save file: ' + err.message, 'error');
		}
	}
}


// コード整形・Minify
function formatCode() {
	if (!activeFileId) return;
	const editor = editors.get(activeFileId);
	editor.getAction('editor.action.formatDocument').run();
	showNotification('Code formatted!');
}

function minifyCode() {
	if (!activeFileId) return;

	const file = files.get(activeFileId);
	const editor = editors.get(activeFileId);
	const content = editor.getValue();

	let minified = content;

	if (file.language === 'javascript' || file.language === 'typescript') {
		minified = content
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*/g, '')
			.replace(/\s+/g, ' ')
			.replace(/\s*([{};,:])\s*/g, '$1')
			.trim();
	} else if (file.language === 'css') {
		minified = content
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\s+/g, ' ')
			.replace(/\s*([{};:,])\s*/g, '$1')
			.trim();
	} else if (file.language === 'html') {
		minified = content
			.replace(/\<!--[\s\S]*?-- > /g, '')
			.replace(/\s+/g, ' ')
			.replace(/>\s+</g, '><')
			.trim();
	} else if (file.language === 'json') {
		try {
			minified = JSON.stringify(JSON.parse(content));
		} catch (e) {
			showNotification('Invalid JSON', 'error');
			return;
		}
	}

	editor.setValue(minified);
	showNotification('Code minified!');
}
// GitHub統合
async function cloneRepository() {
	const token = document.getElementById('github-token').value;
	const repoUrl = document.getElementById('github-repo').value;
	const branch = document.getElementById('github-branch').value;

	if (!token || !repoUrl) {
		showGitStatus('Please enter token and repository URL', 'error');
		return;
	}

	const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
	if (!match) {
		showGitStatus('Invalid GitHub URL', 'error');
		return;
	}

	const [, owner, repo] = match;
	showProgress('Cloning repository...');

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) throw new Error('Failed to fetch repository');

		const data = await response.json();
		const fileItems = data.tree.filter(item => item.type === 'blob');

		fileTree.clear();
		expandedFolders.clear();

		for (const item of fileItems.slice(0, 50)) {
			try {
				const fileResponse = await fetch(item.url, {
					headers: {
						'Authorization': `token ${token}`,
						'Accept': 'application/vnd.github.v3+json'
					}
				});

				const fileData = await fileResponse.json();
				const content = atob(fileData.content);
				addFile(item.path.split('/').pop(), content, null, null, item.path);
			} catch (err) {
				console.error(`Failed to load ${item.path}:`, err);
			}
		}

		hideProgress();
		showGitStatus('Repository cloned successfully!', 'success');
		showNotification('Repository cloned!');
	} catch (err) {
		hideProgress();
		showGitStatus('Failed to clone: ' + err.message, 'error');
	}
}

async function loadGithubFile() {
	const token = document.getElementById('github-token').value;
	const fileUrl = document.getElementById('github-repo').value;

	if (!token || !fileUrl) {
		showGitStatus('Please enter token and file URL', 'error');
		return;
	}

	const match = fileUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
	if (!match) {
		showGitStatus('Invalid GitHub file URL', 'error');
		return;
	}

	const [, owner, repo, branch, path] = match;
	showProgress('Loading file...');

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) throw new Error('Failed to fetch file');

		const data = await response.json();
		const content = atob(data.content);
		const filename = path.split('/').pop();

		addFile(filename, content, null, null, path);
		hideProgress();
		showGitStatus('File loaded successfully!', 'success');
		showNotification('File loaded!');
	} catch (err) {
		hideProgress();
		showGitStatus('Failed to load: ' + err.message, 'error');
	}
}

async function pushToGithub() {
	if (!activeFileId) {
		showGitStatus('No active file to push', 'error');
		return;
	}

	const token = document.getElementById('github-token').value;
	const repoUrl = document.getElementById('github-repo').value;
	const branch = document.getElementById('github-branch').value;

	if (!token || !repoUrl) {
		showGitStatus('Please enter token and repository URL', 'error');
		return;
	}

	const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
	if (!match) {
		showGitStatus('Invalid GitHub URL', 'error');
		return;
	}

	const [, owner, repo] = match;
	const file = files.get(activeFileId);
	const editor = editors.get(activeFileId);
	const content = editor.getValue();

	showProgress('Pushing to GitHub...');

	try {
		let sha = null;
		try {
			const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, {
				headers: {
					'Authorization': `token ${token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			});
			if (getResponse.ok) {
				const getData = await getResponse.json();
				sha = getData.sha;
			}
		} catch (err) { }

		const pushData = {
			message: `Update ${file.path} from BaramCode`,
			content: btoa(unescape(encodeURIComponent(content))),
			branch: branch
		};

		if (sha) pushData.sha = sha;

		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
			method: 'PUT',
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(pushData)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to push');
		}

		hideProgress();
		showGitStatus('Pushed to GitHub successfully!', 'success');
		showNotification('Pushed to GitHub!');

		file.modified = false;
		updateFileTree();
		updateTabBar();
	} catch (err) {
		hideProgress();
		showGitStatus('Failed to push: ' + err.message, 'error');
	}
}

function showGitStatus(message, type = 'success') {
	const status = document.getElementById('git-status');
	status.textContent = message;
	status.className = `git-status show ${type}`;
	setTimeout(() => status.classList.remove('show'), 5000);
}
