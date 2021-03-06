import CallbackQueue = require('./CallbackQueue');
import core = require('./interfaces');
import has = require('./has');

declare var process:any;

has.add('dom-mutationobserver', (global) => {
	if (!has('host-browser')) {
		return;
	}
	return !!(global.MutationObserver || global.WebKitMutationObserver);
});

function noop() {}

var nextTick:(callback:() => void) => core.IHandle;

if (has('host-node')) {
	nextTick = (callback:() => void):core.IHandle => {
		var removed = false;
		process.nextTick(() => {
			// There isn't a way to remove or "clear" a call to
			// process.nextTick(), so just ignore.
			if (removed) { return; }
			callback();
		});

		return {
			remove: function () {
				this.remove = noop;
				removed = true;
			}
		};
	};
}
else {
	var queue = new CallbackQueue<() => void>();

	if (has('dom-mutationobserver')) {
		nextTick = (function () {
			var MutationObserver = this.MutationObserver || this.WebKitMutationObserver,
				element = document.createElement('div'),
				observer = new MutationObserver(() => {
					queue.drain();
				});

			observer.observe(element, { attributes: true });

			// Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
			this.addEventListener('unload', () => {
				observer.disconnect();
				observer = element = null;
			});

			return (callback:() => void):core.IHandle => {
				var handle = queue.add(callback);

				element.setAttribute('drainQueue', '1');

				return handle;
			};
		})();
	}
	else {
		nextTick = (() => {
			var timeout:number = null;
			return (callback:() => void):core.IHandle => {
				var handle = queue.add(callback);

				if (!timeout) {
					timeout = setTimeout(() => {
						clearTimeout(timeout);
						timeout = null;
						queue.drain();
					}, 0);
				}

				return handle;
			};
		})();
	}
}

export = nextTick;
