import { inject, bindable, observable, bindingMode, NewInstance } from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {ValidationController, Validator, ValidationRules, validateTrigger} from 'aurelia-validation';
import {BootstrapFormRenderer} from 'validation/bootstrap-form-renderer';


@inject(Store, NewInstance.of(ValidationController), Validator, BootstrapFormRenderer)
export class QuerySettings {

	@bindable query;
	feedGroups = [];
	selectedFeedGroup;

	query = { feedGroups: [] };
	selectedEntity = '';
	allFeedGroups = [];

	@observable custom;

	@bindable({defaultBindingMode: bindingMode.oneWayOut}) validate;

	constructor(store, validationController, validator, formRenderer) {
		this.store = store;

		this.validationController = validationController;
		this.validator = validator;
		this.formRenderer = formRenderer;
		this.validationController.validateTrigger = validateTrigger.changeOrBlur;

		this.store.getFeedGroups().then(feedGroups => { this.allFeedGroups = feedGroups; });
		this.store.getNamedEntities().then(entities => this.entities = entities);

		this.entitySuggester = {
			suggest: (text) => {
				if (text === '') {
					return Promise.resolve([]);
				}
				let origText = text;
				text = text.toLowerCase();
				if(!this.entities) {
					return Promise.resolve([{ baseForm: origText }]);
				}
				let suggestions = this.entities.filter(entity => entity.baseForm.toLowerCase().indexOf(text) === 0); // TODO: fuzzy matching here
				suggestions.unshift({ baseForm: origText });
				return Promise.resolve(suggestions);
			},
			getName(suggestion) {
				return suggestion.baseForm;
			}
		};

		this.validate = () => this.validationController.validate();
	}

	queryChanged() {
		if(this.query) {
			ValidationRules
				.ensure('name').required()
				.on(this.query);
		}
	}

	attached() {
		this.store.getNamedEntities().then(entities => this.entities = entities);
		this.validationController.addRenderer(this.formRenderer);
	}

	detached() {
		this.validationController.removeRenderer(this.formRenderer);
	}


	addSelectedFeedGroup() {
		if(!this.selectedFeedGroup)
			return;
		log.debug('Add selected feed group:', this.selectedFeedGroup);
		if(!this.query.feedGroups) {
			this.query.feedGroups = [];
		}
		let index = this.query.feedGroups.findIndex((item, index, array) => {
			return this.selectedFeedGroup.id === item.id;
		});
		if(index === -1) {
			this.query.feedGroups.push(this.selectedFeedGroup);
		} else {
			log.info('Feed group already added');
		}
		this.selectedFeedGroup = undefined;
	}

	entitySelected(event) {
		log.debug('Entity selected:', event.value);
		this.selectedEntity = event.value;
		if(!this.query.namedEntities) {
			this.query.namedEntities = [];
		}
		let index = this.query.namedEntities.findIndex((item, index, array) => {
			return this.selectedEntity.baseForm === (typeof item === 'string' ? item : item.baseForm);
		});
		if(index === -1) {
		// if(this.query.namedEntities.indexOf(this.selectedEntity) === -1) {
			this.query.namedEntities.push(this.selectedEntity);
			this.selectedEntity = '';
		} else {
			log.info('Entity already added');
		}
		setTimeout(() => this.selectedEntity = undefined, 100);
	}

	entityTitle(entity) {
		if(typeof entity === 'string') {
			return entity;
		}
		return entity.baseForm;
	}
}
