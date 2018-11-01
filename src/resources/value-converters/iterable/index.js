import {RepeatStrategyLocator} from 'aurelia-templating-resources/repeat-strategy-locator';
import {createFullOverrideContext} from 'aurelia-templating-resources/repeat-utilities';

class IteratorStrategy {
	instanceChanged(repeat, items) {
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

export function configure(config) {
	// config.globalResources(['./iterable']);
	let repeatStrategyLocator = config.aurelia.container.get(RepeatStrategyLocator);
	repeatStrategyLocator.addStrategy(items => typeof items[Symbol.iterator] === 'function', new IteratorStrategy());
}
