import {inject, bindable, bindingMode, NewInstance} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


@inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
export class FeedbackSettings {
	ratingTypes = [];
	@bindable feedback;
	@bindable edit = false;
	screenshot = true;

	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	constructor(store, validationController, validator, formRenderer) {
		this.store = store;

		this.validationController = validationController;
		this.validator = validator;
		this.formRenderer = formRenderer;
		this.validationController.validateTrigger = validateTrigger.manual;
		// this.validationController.validateTrigger = validateTrigger.changeOrBlur;
		this.validate = () => this.validationController.validate();

		this.statuses = this.store.getFeedbackStatuses();
		this.store.getFeedbackRatingTypes().then(ratingTypes => this.ratingTypes = ratingTypes);
	}

	feedbackChanged() {
		if(this.feedback) {
			ValidationRules
				.ensure('comment').required()
				.ensure('guiPath').required()
				.on(this.feedback);
		}
	}

	attached() {
		this.validationController.addRenderer(this.formRenderer);
	}

	detached() {
		this.validationController.removeRenderer(this.formRenderer);
	}
}
