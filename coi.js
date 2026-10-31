if ('serviceWorker' in navigator && window.top === window) {
	navigator.serviceWorker.getRegistrations()
		.then((registrations) => Promise.all(registrations
			.filter((registration) => {
				const worker = registration.active || registration.waiting || registration.installing;
				return worker && new URL(worker.scriptURL).pathname !== '/coi-sw.js';
			})
			.map((registration) => registration.unregister())))
		.then((removed) => {
			if (removed.some(Boolean)) {
				location.reload();
			}
		});
}

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
