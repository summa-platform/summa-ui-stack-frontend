// https://github.com/aurelia/templating-resources/issues/41#issuecomment-182583959
// https://github.com/martingust/aurelia-repeat-strategies/blob/master/src/iterable-repeat-strategy.js
import {RepeatStrategyLocator} from 'aurelia-templating-resources/repeat-strategy-locator';
import {createFullOverrideContext} from 'aurelia-templating-resources/repeat-utilities';

// export class App {
// 	static inject = [RepeatStrategyLocator];
//
// 	data = {
// 		"first": {
// 			something: true
// 		},
// 		"second": {
// 			something: false
// 		}
// 	};
//
// 	constructor(repeatStrategyLocator) {
// 		repeatStrategyLocator.addStrategy(items => typeof items[Symbol.iterator] === 'function', new IteratorStrategy());
// 	}
// }

export class IterableValueConverter {
	toView(value) {
		let index = 0;
		if(value === undefined) {
			return;
		}
		let propKeys = Reflect.ownKeys(value);
		return {
			[Symbol.iterator]() {
				return this;
			},
			next() {
				if (index < propKeys.length) {
					let key = propKeys[index];
					index++;
					return { value: [key, value[key]] };
				} else {
					return { done: true };
				}
			}
		};
	}
}

class IteratorStrategy {
	instanceChanged(repeat, items) {
		let removePromise = repeat.viewSlot.removeAll(true);
		if (removePromise instanceof Promise) {
			removePromise.then(() => this._standardProcessItems(repeat, items));
			return;
		}
		this._standardProcessItems(repeat, items);
	}
	_standardProcessItems(repeat, items) {
		let index = 0;
		for(let [key, value] of items) {
			let overrideContext = createFullOverrideContext(repeat, value, index, undefined, key);
			let view = repeat.viewFactory.create();
			view.bind(overrideContext.bindingContext, overrideContext);
			repeat.viewSlot.add(view);
			++index;
		}
	}
	instanceMutated(repeat, items, changes) {
	}
	getCollectionObserver(observerLocator, items) {
	}
}
