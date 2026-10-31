import createEdgeModule from './edge-classic.js';

const defaultDoomIWad = "/freedoom2.wad";
const defaultHereticIWad = "/blasphem.wad";
const indexDBName = "/edge-classic";

function getCookie(cname) {
	const name = cname + "=";
	for (let c of document.cookie.split(';')) {
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

function reportError(message) {
	alert(message);
	console.error(message);
	console.trace();
}

function openDatabase() {
	return new Promise((resolve, reject) => {
		const dbrequest = window.indexedDB.open(indexDBName);

		dbrequest.onerror = () => {
			reject(`unable to load database ${indexDBName}`);
		};

		dbrequest.onupgradeneeded = (e) => {
			console.log("upgrade needed");
			const db = e.target.result;
			if (!db.objectStoreNames.contains("FILE_DATA")) {
				console.log("Creating FILE_DATA object store");
				const store = db.createObjectStore("FILE_DATA", {});
				store.createIndex("timestamp", "timestamp", { unique: false });
			}
		};

		dbrequest.onsuccess = (e) => {
			console.log("db open");
			resolve(e.target.result);
		};
	});
}

function storeWad(database, file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsArrayBuffer(file);

		reader.onload = (e) => {
			const contents = new Uint8Array(e.target.result);
			const iwad = contents[0] === 73;

			const trans = database.transaction(['FILE_DATA'], 'readwrite');
			const path = `${indexDBName}/${file.name}`;
			const addReq = trans.objectStore('FILE_DATA').put({ timestamp: new Date(), mode: 33206, contents: contents }, path);

			addReq.onerror = () => {
				reject("Error storing wad data");
			};

			trans.oncomplete = () => {
				resolve({ wadName: file.name, isIWAD: iwad });
			};
		};

		reader.onerror = () => {
			reject("Error reading wad");
		};
	});
}

async function uploadWads(files) {
	const wads = [];

	for (const file of files) {
		let database;
		try {
			database = await openDatabase();
		} catch (e) {
			reportError(e);
			return;
		}

		try {
			wads.push(await storeWad(database, file));
		} catch (e) {
			reportError(e);
		} finally {
			database.close();
		}
	}

	if (wads.length) {
		startEngine(wads);
	}
}

function startEngine(wadState) {
	document.getElementById('chooser').hidden = true;

	const canvasContainer = document.getElementById('canvas-container');
	const canvas = document.getElementById('canvas');
	const loading = document.getElementById('loading');
	canvasContainer.hidden = false;

	const iwad = wadState.find(w => w.isIWAD) ?? { wadName: defaultDoomIWad, isIWAD: true };

	console.log("WadState", wadState);

	const syncCanvasSize = () => {
		const w = Math.floor(canvasContainer.offsetWidth);
		const h = Math.floor(canvasContainer.offsetHeight);
		console.log("Setting canvas size", w, h);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		canvas.width = w;
		canvas.height = h;
	};

	syncCanvasSize();

	let doSyncTimeout;
	window.addEventListener("resize", () => {
		clearTimeout(doSyncTimeout);
		doSyncTimeout = setTimeout(() => {
			syncCanvasSize();
			Module._WebSyncScreenSize();
		}, 250);
	});

	canvas.addEventListener("webglcontextlost", (e) => { alert('FIXME: WebGL context lost, please reload the page'); e.preventDefault(); }, false);

	canvas.addEventListener("click", async () => {
		if (canvas !== document.pointerLockElement) {
			try {
				await canvas.requestPointerLock();
			} catch (err) {
				console.error(err);
			}
		}
	});

	let iwadPath = iwad.wadName;
	if (iwadPath !== defaultDoomIWad && iwadPath !== defaultHereticIWad) {
		iwadPath = `edge-classic/${iwadPath}`;
	}

	const args = ["-home", "/edge-classic", "-windowed", "-width", canvas.offsetWidth.toString(), "-height", canvas.offsetHeight.toString(), "-iwad", iwadPath];

	for (const w of wadState) {
		if (!w.isIWAD) {
			args.push("-file", `edge-classic/${w.wadName}`);
		}
	}

	const customCommandLine = getCookie("customCommandLineCookie");
	if (customCommandLine?.length) {
		args.push(...customCommandLine.split(" "));
	}

	createEdgeModule({
		edgePostInit: () => {
			console.log("Post-Init!");
			if (!args.find(a => a.startsWith("-warp"))) {
				Module._WebOpenGameMenu(1);
			}
			loading.hidden = true;
			canvas.classList.add('ready');
		},
		onFullscreen: () => {},
		preEdgeSyncFS: () => {},
		postEdgeSyncFS: () => {},
		arguments: args,
		preInit: () => {
			console.log("Pre-Init");
		},
		preRun: [],
		postRun: [],
		print: (...text) => console.log(text.join(' ')),
		printErr: (...text) => console.error(text.join(' ')),
		canvas: canvas,
		setStatus: (text) => console.log("status", text),
		monitorRunDependencies: (left) => console.log(left),
	}).then(module => {
		globalThis.Module = module;
		module.canvas = canvas;
	});
}

document.getElementById('play-freedoom').addEventListener('click', () => {
	startEngine([{ wadName: defaultDoomIWad, isIWAD: true }]);
});

document.getElementById('play-blasphemer').addEventListener('click', () => {
	startEngine([{ wadName: defaultHereticIWad, isIWAD: true }]);
});

const fileInput = document.getElementById('getWadFile');

document.getElementById('play-files').addEventListener('click', () => {
	fileInput.click();
});

fileInput.addEventListener('change', () => {
	const files = Array.from(fileInput.files);
	if (files.length === 0) {
		return;
	}

	const badFile = files.find(f => {
		const check = f.name.toLowerCase();
		return !check.endsWith(".wad") && !check.endsWith(".zip") && !check.endsWith(".epk") && !check.endsWith(".7z");
	});

	if (badFile) {
		fileInput.value = "";
		alert(`Please select wad, epk, or zip files, ${badFile.name} is invalid`);
		return;
	}

	uploadWads(files);
});

const commandLine = document.getElementById('command-line');
commandLine.value = getCookie("customCommandLineCookie")?.trim() ?? "";
commandLine.addEventListener('change', () => {
	const value = commandLine.value.trim().replace("\n", " ");
	document.cookie = `customCommandLineCookie=${value}; SameSite=None; Secure`;
});

const licenses = document.getElementById('licenses');
document.getElementById('show-licenses').addEventListener('click', () => licenses.showModal());
document.getElementById('close-licenses').addEventListener('click', () => licenses.close());
