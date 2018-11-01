import {inject, bindable, observable, bindingMode, NewInstance} from 'aurelia-framework';
import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
import log from 'logger';
import {Store} from 'store';
import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


@inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
export class UserSettings {
	@bindable user = {};
	@bindable new = true;
	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	constructor(store, validationController, validator, formRenderer) {
		this.store = store;
		this.validationController = validationController;
		this.validator = validator;
		this.formRenderer = formRenderer;
		this.validationController.validateTrigger = validateTrigger.changeOrBlur;
		this.store.getUserRoleTypes().then(roleTypes => this.roleTypes = roleTypes);
		// this.store.getUserRoleTypes().then(roleTypes => console.log(roleTypes));
		
		this.validate = () => this.validationController.validate();

		ValidationRules.customRule(
			'matchesProperty',
			(value, obj, otherPropertyName) => 
				// value === null
				// || value === undefined
				// || value === ''
				// || obj[otherPropertyName] === null
				// || obj[otherPropertyName] === undefined
				// || obj[otherPropertyName] === ''
				// || value === obj[otherPropertyName],
				value && obj[otherPropertyName] &&
				value === obj[otherPropertyName],
			'${$displayName} must match ${$getDisplayName($config.otherPropertyName)}', otherPropertyName => ({ otherPropertyName })
		);

	}

	userChanged() {
		ValidationRules
			.ensure('email').displayName('e-mail').email().required()
			.ensure('name').required()
			.ensure(a => a.password)
				.required()
				.when(user => this.new)
			.ensure(a => a.confirmPassword)
				.required()
				.when(user => this.new || (user.password && user.password.length > 0))
				.satisfiesRule('matchesProperty', 'password')
				.when(user => this.new || (user.password && user.password.length > 0))
			.ensure(a => a.currentPassword)
				.required()
				.when(user => !this.new && user.password && user.password.length > 0 && (this.store.currentUser.id === user.id /*|| this.store.currentUser.role !== 'admin'*/))
			.on(this.user);
	}

	attached() {
		this.validationController.addRenderer(this.formRenderer);
		// this.validationController.validate();
	}

	detached() {
		this.validationController.removeRenderer(this.formRenderer);
	}

	log() {
		console.log(this.validationController.errors);
		console.log(this);
	}
}
