
// based on: https://gist.run/?id=61b94e889c95d4336de7

function observeProperty(obj, property) {
	this.standardObserveProperty(obj, property);
	let value = obj[property];
	// // array: items = ['a', 'b', 'c'] | ${items[1] & array}
	// if (Array.isArray(value)) {
	// 	this.observeArray(value);
	// }
	// // set: mySet = new Set() | ${mySet.has('foo') & set}
	// if (value instanceof Set) {
	// 	this.addObserver(this.observerLocator.getSetObserver(value));
	// }
	// object
	for(let key of Object.keys(value)) {
		this.standardObserveProperty(value, key);
	}
}

export class ObservePropertiesBindingBehavior {
	bind(binding, scope, interceptor) {
		binding.standardObserveProperty = binding.observeProperty;
		binding.observeProperty = observeProperty;
	}

	unbind(binding, scope) {
		binding.observeProperty = binding.standardObserveProperty;
		binding.standardObserveProperty = null;
	}
}
