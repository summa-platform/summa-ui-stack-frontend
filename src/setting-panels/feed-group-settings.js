import {inject, bindable, bindingMode, NewInstance} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


@inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
export class FeedGroupSettings {
	@bindable feedGroup = {};

	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	constructor(store, validationController, validator, formRenderer) {
		this.store = store;

		this.validationController = validationController;
		this.validator = validator;
		this.formRenderer = formRenderer;
		this.validationController.validateTrigger = validateTrigger.manual;
		// this.validationController.validateTrigger = validateTrigger.changeOrBlur;
		this.validate = () => this.validationController.validate();

		this.feedTypes = this.store.feedTypes;
		this.store.getFeedGroups().then(feedGroups => this.allFeedGroups = feedGroups);
		this.store.getFeeds().then(feeds => this.allFeeds = feeds);
	}

	feedGroupChanged() {
		if(this.feedGroup) {
			ValidationRules
				.ensure('name').required()
				.on(this.feedGroup);
		}
	}

	attached() {
		this.validationController.addRenderer(this.formRenderer);
	}

	detached() {
		this.validationController.removeRenderer(this.formRenderer);
	}

	addSelectedFeed() {
		if(this.feedGroup) {
			if(!this.feedGroup.feeds) {
				this.feedGroup.feeds = [];
			}
			if(this.selectedFeed) {
				log.debug('Selected feed:', this.selectedFeed);
				let index = this.feedGroup.feeds.findIndex((item, index, array) => {
					return this.selectedFeed.id === item.id;
				});
				if(index === -1) {
					this.feedGroup.feeds.push(this.selectedFeed);
				} else {
					log.info('Selected feed already added!');
				}
				this.selectedFeed = undefined;
			}
		}
	}
}
