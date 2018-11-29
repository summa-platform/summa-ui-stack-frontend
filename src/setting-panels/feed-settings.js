import {inject, bindable, bindingMode, NewInstance} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


@inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
export class FeedSettings {
	@bindable feed = {};
	// @bindable({defaultBindingMode: bindingMode.twoWay}) feed;
	selectedFeedGroupError = '';

	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	constructor(store, validationController, validator, formRenderer) {
		this.store = store;

		this.validationController = validationController;
		this.validator = validator;
		this.formRenderer = formRenderer;
		this.validationController.validateTrigger = validateTrigger.manual;
		// this.validationController.validateTrigger = validateTrigger.changeOrBlur;
		this.validate = () => this.validationController.validate();

		this.store.getFeedTypes().then(feedTypes => {
			this.feedTypes = feedTypes;
			this.feedTypeTitle = this.feedTypes.reduce((acc, feed) => { acc[feed.internalval] = feed.label; return acc; }, {});
		});

		this.store.getFeedGroups().then(feedGroups => this.allFeedGroups = feedGroups);

		// this.saveRules = ValidationRules
		// 	.ensure('name').required()
		// 	.ensure('url').required();
		// this.groupRules = ValidationRules
		// 	.ensure('selectedFeedGroup')
		// 	.satisfies(group => this.feed.groups.indexOf(group) === -1)
		// 	.withMessage('Selected feed group already in list.')
		// 	.on(this);
	}

	feedChanged() {
		if(this.feed) {
			ValidationRules
				.ensure('name').required()
				// .ensure('url').required()
				.on(this.feed);
		}
	}

	attached() {
		this.validationController.addRenderer(this.formRenderer);
	}

	detached() {
		this.validationController.removeRenderer(this.formRenderer);
	}

	async addSelectedFeedGroup() {
		// let errors = await this.validationController.validate();
		// log.debug('validation errors:', errors);
		
		if(this.selectedFeedGroup && this.feed.feedGroups && this.feed.feedGroups.indexOf(this.selectedFeedGroup) !== -1) {
			this.selectedFeedGroupError = 'Selected feed group already added!';
			return;
		} else {
			this.selectedFeedGroupError = '';
		}

		if(!this.selectedFeedGroup)
			return;

		if(this.feed) {
			if(!this.feed.feedGroups) {
				this.feed.feedGroups = [];
			}
			log.debug('Selected feed group:', this.selectedFeedGroup);
			if(this.selectedFeedGroup && this.feed.feedGroups.indexOf(this.selectedFeedGroup) === -1) {
				this.feed.feedGroups.push(this.selectedFeedGroup);
				this.error = '';
			} else {
				log.info('Selected feed group already added!');
			}
		}
		this.selectedFeedGroup = undefined;
	}
}
