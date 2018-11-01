
// Based on example from: http://aurelia.io/hub.html#/doc/article/aurelia/binding/latest/binding-binding-behaviors/8
export class OneWayOutBindingBehavior {
	bind(binding, scope, interceptor) {
		// disable updateTarget function
		let method = 'updateTarget';
		if(!binding[method])
			return;
		binding[`-${method}`] = binding[method];
		binding[method] = () => {};
	}

	unbind(binding, scope) {
		let method = 'updateTarget';
		if(!binding[method] || !binding[`-${method}`])
			return;
		binding[method] = binding[`-${method}`];
	}
}

// Full example from: http://aurelia.io/hub.html#/doc/article/aurelia/binding/latest/binding-binding-behaviors/8
// const interceptMethods = ['updateTarget', 'updateSource', 'callSource'];
// export class InterceptBindingBehavior {
// 	bind(binding, scope, interceptor) {
// 		let i = interceptMethods.length;
// 		while (i--) {
// 			let method = interceptMethods[i];
// 			if (!binding[method]) {
// 				continue;
// 			}
// 			binding[`intercepted-${method}`] = binding[method];
// 			let update = binding[method].bind(binding);
// 			binding[method] = interceptor.bind(binding, method, update);
// 		}
// 	}
//
// 	unbind(binding, scope) {
// 		let i = interceptMethods.length;
// 		while (i--) {
// 			let method = interceptMethods[i];
// 			if (!binding[method]) {
// 				continue;
// 			}
// 			binding[method] = binding[`intercepted-${method}`];
// 			binding[`intercepted-${method}`] = null;
// 		}
// 	}
// }
