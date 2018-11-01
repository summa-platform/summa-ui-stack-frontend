import { inject, bindable, observable, bindingMode, NewInstance } from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {Services} from 'services';


@inject(Router, Store, Services)
export class Entity {

	@observable selectedMediaItem;
	entityDetails = undefined;

	constructor(router, store, services) {
		this.router = router;
		this.store = store;
		this.services = services;
		/*
		if(this.store.namedEntities && this.store.namedEntities.length > 0) {
			this.entities = this.store.namedEntities;
			this.entitiesPromise = Promise.resolve(this.entities);
		} else {
			this.entitiesPromise = this.store.getNamedEntities().then(entities => { 
				this.entities = entities;
				return entities;
			});
		}
		*/
	}

	fixDetails() {
		function extractEntities(list) {
			if(!list)
				return list;
			if(!Array.isArray(list))
				return list;
			let entities = {};
			for(let item in list) {
				if(typeof item !== 'string') {
					for(let id in item.entities) {
						entities[id] = item.entities[id];
					}
				}
			}
			return entities;
		}
		function entitiesToList(obj) {
			let entries = [];
			if(obj) {
				for(let key in obj) {
					entries.push({id: key, text: obj[key]});
				}
			}
			return entries;
		}
		function sortedEntityIDList(entities) {
			// let ids = [];
			// for(let entity of entities) {
			// 	ids.push(entity.id);
			// }
			// return ids.sort();
			return entities.map(({id}) => id).sort();
		}
		if(!this.entityDetails.relationships) {
			this.entityDetails.relationships = [];
			return;
		}
		let sourceTitles = {};
		for(let mention of this.entityDetails.mentions) {
			sourceTitles[mention.id] = mention.engTitle;
		}
		let relationships = [];
		let relationshipPrecedents = {};
		for(let relationship of this.entityDetails.relationships) {
			if(!relationship.roles)
				continue;
			if(!relationship.roles.ARG0 && !relationship.roles.ARG1 || !relationship.roles.ARG2)
				continue;
			if(relationship.name !== 'have-org-role-91')
				continue;
			relationship.roles.ARG0 = entitiesToList(extractEntities(relationship.roles.ARG0));
			relationship.roles.ARG1 = entitiesToList(extractEntities(relationship.roles.ARG1));
			relationship.roles.ARG2 = typeof relationship.roles.ARG2 === 'string' ? relationship.roles.ARG2 : relationship.roles.ARG2.join(' ');
			// WORKAROUND: the entity of current view must be attached to some role of the relationship, or the relationship is not for current view
			let found = false;
			for(let entity of relationship.roles.ARG0) {
				if(entity.id == this.entity.id) {
					found = true;
					break;
				}
			}
			if(!found) {
				for(let entity of relationship.roles.ARG1) {
					if(entity.id == this.entity.id) {
						found = true;
						break;
					}
				}
			}
			if(!found)
				continue;
			// if(Object.keys(relationship.roles.ARG0).length === 0 || Object.keys(relationship.roles.ARG1).length == 0)
			if(relationship.roles.ARG0.length === 0 || relationship.roles.ARG1.length === 0)
				continue;
			if(relationship.roles.ARG0.length > 1 || relationship.roles.ARG1.length > 1)
				continue;
			let key = relationship.name+':'+[
				// sortedEntityIDList(relationship.roles.ARG0).join(','),
				// sortedEntityIDList(relationship.roles.ARG1).join(','),
				// relationship.roles.ARG2.toLowerCase()
				'ARG0='+sortedEntityIDList(relationship.roles.ARG0).join(','),
				'ARG1='+sortedEntityIDList(relationship.roles.ARG1).join(','),
				'ARG2='+relationship.roles.ARG2.toLowerCase()
			].join(';');
			let precedent = relationshipPrecedents[key];
			if(precedent) {
				// if(precedent.sources.indexOf(relationship.source) === -1) {
				// if(!precedent.sources.reduce((acc, item) => acc || item.id == relationship.source, false)) {
				if(!precedent.sources.find(item => item.id == relationship.source && item)) {
					if(relationship.sources) {
						let sources = precedent.sources;
						for(let s of relationship.sources) {
							sources.push({id: s, title: sourceTitles[s]})
						}
					} else {
						precedent.sources.push({id: relationship.source, title: sourceTitles[relationship.source]});
					}
				}
			} else {
				if(relationship.sources) {
					let sources = [];
					for(let s of relationship.sources) {
						sources.push({id: s, title: sourceTitles[s]})
					}
					relationship.sources = sources;
				} else {
					relationship.sources = [{id: relationship.source, title: sourceTitles[relationship.source]}];
				}
				relationshipPrecedents[key] = relationship;
				relationships.push(relationship);
			}
		}
		this.entityDetails.relationships = relationships;
	}

	async activate(params) {
		this.params = params;

		if(params.entityID) {
			this.store.getNamedEntityDetails(params.entityID).then(entity => {
				this.entity = this.entityDetails = entity;
				this.fixDetails();
			});
			// this.entity = this.entityDetails = await this.store.getNamedEntityDetails(params.entityID);
			// this.fixDetails();
			/*
			this.entitiesPromise.then(async entities => {
				this.entity = entities.find(entity => entity.id == params.entityID);
				if(this.entity) {
					this.entityDetails = await this.store.getNamedEntityDetails(this.entity.id);
					this.fixDetails();
				}
			});
			*/
			// this.mediaItems = await this.store.getNamedEntityMediaItems(params.entityID);
		}
	}

	selectMediaItem(mediaItem) {
		this.selectedMediaItem = mediaItem;
	}

	async viewMediaItem(mediaItem, event) {
		// current route name: this.routeConfig.name
		const route = 'media-item';
		const params = {
			mediaItemID: mediaItem.id
		};

		// TODO: use router to generate url (route to sibling subrouter)
		let url = '#/trending/media-items/:mediaItemID';
		for(const param of Object.keys(params)) {
			let re = new RegExp(':'+param, 'g');
			url = url.replace(re, params[param])
		}

		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
			// use any modifier as and excuse to open in separate tab/window
			// const url = this.router.generate(route, params);
			window.open(url, '_blank');
		} else {
			// this.router.navigateToRoute(route, params, { trigger: true });
			window.location.href = url;
		}
	}
}
