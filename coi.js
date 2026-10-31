if (window.crossOriginIsolated) {
	sessionStorage.removeItem('coiReloaded');
} else if (window.isSecureContext && 'serviceWorker' in navigator) {
	navigator.serviceWorker.register('/coi-sw.js')
		.then(() => navigator.serviceWorker.ready)
		.then(() => {
			if (window.top === window && !sessionStorage.getItem('coiReloaded')) {
				sessionStorage.setItem('coiReloaded', '1');
				location.reload();
			}
		})
		.catch((err) => console.error('Cross-origin isolation service worker failed', err));
}
