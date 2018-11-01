import { inject, bindable, observable, bindingMode, NewInstance } from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';


@inject(Router, Store, Services)
export class Entities {

	entityTypes;
	selected;
	@observable entities;
	@observable searchText;

	constructor(router, store, services) {
		this.router = router;
		this.store = store;
		this.services = services;
		this.entitiesPromise = this.store.getNamedEntities().then(entities => {
			this.allEntities = entities;
			this.entityTypes = {};
			for(const entity of entities) {
				this.entityTypes[entity.type] = true;
			}
			// this.filter();
			// console.log(entities)
		});
	}

	async activate(params) {
		this.params = params;

		if(params.searchText) {
			this.filterTextInput = params.searchText;
			this.entitiesPromise.then(async entities => {
				this.search(params.searchText);
			});
		}
	}

	searchTextChanged(text) {
		this.search(text);
	}

	async search(text) {
		this.router.navigateToRoute('entitiesSearch', { searchText: text || '' }, { trigger: false });
		if(!text || text.length === 0) {
			this.entities = [];
			return;
		}
		text = text.toLowerCase();
		const entityTypes = this.entityTypes;
		this.entities = this.allEntities.filter(entity => entityTypes[entity.type] && entity.baseForm.toLowerCase().indexOf(text) != -1);
	}

	async filter() {
		// this.entities = this.allEntities;
	}

	select(entity) {
		this.selected = entity;
	}

	view(entity, event) {
		// current route name: this.routeConfig.name
		const route = 'entity';
		const params = {
			entityID: entity.id
		};

		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
			// use any modifier as and excuse to open in separate tab/window
			const url = this.router.generate(route, params);
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute(route, params, { trigger: true });
		}
	}

}
