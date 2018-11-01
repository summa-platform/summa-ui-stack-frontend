import {inject, bindable, observable} from 'aurelia-framework';
import {Store} from 'store';
import {Router, Redirect} from 'aurelia-router';
import {Services} from 'services';
//
// https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
// https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
// alternate (possibly compatible) implementation: https://jsfiddle.net/gabrieleromanato/qAGHT/
function b64EncodeUnicode(str) {
	// first we use encodeURIComponent to get percent-encoded UTF-8,
	// then we convert the percent encodings into raw bytes which
	// can be fed into btoa.
	return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
		function toSolidBytes(match, p1) {
			return String.fromCharCode('0x' + p1);
	})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '.');
}

function b64DecodeUnicode(str) {
	// Going backwards: from bytestream, to percent-encoding, to original string.
	str = str.replace(/\./g, '=').replace(/_/g, '/').replace(/-/g, '+');
	return decodeURIComponent(atob(str).split('').map(function(c) {
		return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
	}).join(''));
}

function encode(obj) {
	return b64EncodeUnicode(JSON.stringify(obj));
}

function decode(str) {
	return JSON.parse(b64DecodeUnicode(str));
}

@inject(Store, Router, Services)
export class FeedSettingsDialog {

	@bindable model;
	bins = [];

	constructor(store, router, services) {
		this.store = store;
		this.router = router;
		this.services = services;
	}

	selectBin(binIndex, event, resolve) {
		const pastHour = -(binIndex-23);

		/*
		const params = {
			feedID: this.model.id,
			pastHour: this.epochTimeSecs+'-'+pastHour
		};

		// TODO: use router to generate url (route to sibling subrouter)
		let url = '#/trending/feeds/:feedID/hours/:pastHour/media-items';
		for(const param of Object.keys(params)) {
			let re = new RegExp(':'+param, 'g');
			url = url.replace(re, params[param])
		}

		if(this.services.altTouch || event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) {
			// use any modifier as and excuse to open in separate tab/window
			window.open(url, '_blank');
		} else {
			window.location.href = url;
			resolve(); // dismiss dialog
		}
		*/

		let state = {
			feedGroups: [{feed: this.model.id, name: 'Feed '+this.model.id}],
			// feeds: [{id: this.model.id, name: 'Feed '+this.model.id}],
			feeds: [{id: this.model.id, name: 'Feed '+this.model.id}],
			from: '-1h',
			till: '-'+pastHour+'h',
			active: 'list',
		}

		console.log(state);

		let action = 'new';
		// let state = encode(this.packState(override));
		state = encode(state);
		// const route = 'query-trending-id';
		// let url;
		// if(action == 'url' || action == 'new') {
		// 	url = this.router.generate(route, { queryID: state });
		// }
		// if(action == 'url') {
		// 	return url;
		// } else if(action == 'new') {
		// 	window.open(url, '_blank');
		// } else {
		// 	this.router.navigateToRoute(route, { queryID: state }, { trigger: action == 'trigger' });
		// }
		let url = '#/trending/'+state;
		// for(const param of Object.keys(params)) {
		// 	let re = new RegExp(':'+param, 'g');
		// 	url = url.replace(re, params[param])
		// }

		if(this.services.altTouch || event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) {
			// use any modifier as and excuse to open in separate tab/window
			window.open(url, '_blank');
		} else {
			window.location.href = url;
			resolve(); // dismiss dialog
		}
	}

	packState(override) {
		if(!override) {
			override = {};
		}
		console.log('PACK STATE:', this.fromTag, this.timeFromString, this.tillTag, this.timeTillString);
		let from = (override.fromTag || this.fromTag);
		let till = (override.tillTag || this.tillTag);
		if(from == 'date' || from == 'date-time') {
			from = '@'+moment(override.timeFromString || this.timeFromString).format('YYYY-MM-DD HH:mm:ss');
		}
		if(till == 'date' || till == 'date-time') {
			till = '@'+moment(override.timeTillString || this.timeTillString).format('YYYY-MM-DD HH:mm:ss');
		}
		let entities = [];
		for(let entity of (override.selectedEntities || this.selectedEntities)) {
			// entities.push(typeof entity === 'string' ? entity : entity.id);
			entities.push(typeof entity === 'string' ? entity : Object.assign({}, {id: entity.id, baseForm: entity.baseForm}));
		}
		entities.sort();
		let feedGroups = [];
		for(let feedGroup of (override.selectedFeedGroups || this.selectedFeedGroups)) {
			feedGroups.push(typeof feedGroup === 'string' ? feedGroup : feedGroup.id);
		}
		feedGroups.sort();
		/*
		let mediaTypes = [];
		for(let mediaType of this.filterMediaTypes) {
			if((override.filterMediaTypes || this.filters.mediaTypes)[mediaType.key]) {
				mediaTypes.push(mediaType.key);
			}
		}
		let languages = [];
		for(let language of this.filterLanguages) {
			if((override.filterLanguages || this.filters.languages)[language.key]) {
				languages.push(language.key);
			}
		}
		*/
		let active = override.active !== undefined ? override.active : this.active;
		if(active == 1) {
			active = 'list';
		} else {
			active = 'trending';
		}
		let state = {
			entities: entities,
			feedGroups: feedGroups,
			from: from,
			till: till,
			// mediaTypes: mediaTypes,
			// languages: languages,
			active: active,
		};
		console.log('PACKED STATE:', state);
		return state;
	}

	async modelChanged(feed) {

		let query = { feeds: [feed.id], from: '-24h', till: 'now', totalOnly: true }
		let trending = await this.store.getTrending(query);
		// let trending = await this.store.getFeedTrending(feed.id);
		// trending.epochTimeSecs
		// trending.last24hStats

		this.epochTimeSecs = trending.epochTimeSecs;
		// const trendObject = trending.last24hStats;
		const trendObject = trending.totalBins;

		const bins = [];
		let total = 0;
		for(let i=0; i<24; ++i) {
			total += bins[i] = trendObject[i-23 || '-0'] || 0;	// from -24 till 0
			// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
		}
		this.bins = bins;
	}

	async check(feed, validate, resolve) {
		let result = await validate();
		if(result.valid) {
			resolve(feed);
		}
	}
}
