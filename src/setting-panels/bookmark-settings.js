import { inject, bindable, observable, bindingMode, NewInstance } from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
// import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
// import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


// @inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
@inject(Store)
export class BookmarkSettings {

	@bindable bookmark = {};

	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	// constructor(store, validationController, validator, formRenderer) {
	constructor(store) {
		this.store = store;

		// this.validationController = validationController;
		// this.validator = validator;
		// this.formRenderer = formRenderer;
		// this.validationController.validateTrigger = validateTrigger.changeOrBlur;

		this.store.getBookmarkTypes().then(bookmarkTypes => { this.bookmarkTypes = bookmarkTypes; });

		// this.validate = () => this.validationController.validate();
	}

	// bookmarkChanged() {
	// 	if(this.bookmark) {
	// 		ValidationRules
	// 			.ensure('title').required()
	// 			.on(this.bookmark);
	// 	}
	// }

	attached() {
		// this.validationController.addRenderer(this.formRenderer);
	}

	detached() {
		// this.validationController.removeRenderer(this.formRenderer);
	}

	log() {
		log.debug('Bookmark:', this.bookmark);
	}
}
