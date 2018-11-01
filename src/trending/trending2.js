import {inject, bindable, observable, BindingEngine} from 'aurelia-framework';
import {Router, Redirect} from 'aurelia-router';
import log from 'logger';
import {Store} from 'store';
import {CompositionService} from 'composition-service';
import {Services} from 'services';
import moment from 'moment';
import {CssAnimator} from 'aurelia-animator-css';
import jQuery from 'jquery';
import 'bootstrap-select';

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

function isRelativeTag(str) {
	if(!str) {
		return false;
	}
	if(str == 'now') {
		return true;
	}
	let validateRE = /\s*(?:-|\+)?\s*(?:(?:\d+(?:.\d+)?)\s*(?:ns|us|µs|ms|s|m|h|y|w|M|mo|d)\s*)+/g;
	if(str.match(validateRE)) {
		return true;
	}
	return false;
}

function relativeDate(str, relativeTo) {
	let validateRE = /\s*-?\s*(?:(?:\d+(?:.\d+)?)\s*(?:ns|us|µs|ms|s|m|h|y|w|M|mo|d)\s*)+/g;
	if(!str.match(validateRE)) {
		throw 'invalid duration string: '+str;
	}
	let signPrefixRE = /^\s*-/g;
	let sign = str.match(signPrefixRE) ? -1 : 1;
	let partRE = /(\d+(?:.\d+)?)\s*(ns|us|µs|ms|s|m|h|y|w|M|mo|d)/g;
	let date, match;
	let validUnits = ['ms','s','m','h','y','w','M','mo','d'];
	let skipUnits = ['us','µs','ns'];
	if(!relativeTo) {
		date = moment(new Date());
	} else if(relativeTo instanceof Date) {
		date = moment(relativeTo);	// TODO: check if instance of moment instead
	} else {
		date = relativeTo;
	}
	while((match = partRE.exec(str)) != null) {
		let v = match[1];
		let unit = match[2];
		if(unit == 'mo') {
			unit = 'M';
		// } else if(unit == 'us' || unit == 'µs' || unit == 'ns') {
		} else if(skipUnits.indexOf(unit) != -1) {
			continue;
		} else if(validUnits.indexOf(unit) == -1) {
			throw 'invalid unit: '+unit;
			// continue;
		}
		date = date.add(sign*v, unit);
	}
	return date;
}

const fromTagDefault = '-24h';
const tillTagDefault = 'now';

const zoomRatios = {
	'20': '1128.497220',
	'19': '2256.994440',
	'18': '4513.988880',
	'17': '9027.977761',
	'16': '18055.955520',
	'15': '36111.911040',
	'14': '72223.822090',
	'13': '144447.644200',
	'12': '288895.288400',
	'11': '577790.576700',
	'10': '1155581.153000',
	'9': '2311162.307000',
	'8': '4622324.614000',
	'7': '9244649.227000',
	'6': '18489298.450000',
	'5': '36978596.910000',
	'4': '73957193.820000',
	'3': '147914387.600000',
	'2': '295828775.300000',
	'1': '591657550.500000'
};

const latLngParseRE = /\d+(.\d+)?([eE][+-]?\d+)?/g;

@inject(Store, Router, CompositionService, Services, BindingEngine, CssAnimator)
export class Trending {

	// current state
	@bindable selectedEntities = [];
	@bindable selectedFeedGroups = [];
	@bindable fromTag = fromTagDefault;
	@bindable tillTag = tillTagDefault;
	@bindable fullTextSearch = '';

	// helper variables
	selectedEntity = '';
	selectedFeedGroup = undefined;
	// https://www.npmjs.com/package/aurelia-bootstrap-datetimepicker
	// @observable timeFromString = moment().subtract({hours: 24});
	// @observable timeTillString = moment();
	@observable timeFromString;	// NOTE: setting values here led to conflicts with restoring state
	@observable timeTillString;	// NOTE: setting values here led to conflicts with restoring state

	@observable perPage = 100;
	@observable page = 1;
	totalCount = 0;
	totalPages = 1;
	@observable perPage2 = 50;
	@observable page2 = 1;
	totalCount2 = 0;
	totalPages2 = 1;
	@observable clustersSortBy = 'size';
	defaultClusterCount = 20;
	@observable topClusters = this.defaultClusterCount;
	@observable clusterID = undefined;

	allFeedGroups = [];
	allFeeds = [];
	@bindable mediaItems = [];
	@bindable allClusters = [];
	allQueries = [];
	entities = [];

	@observable active;// = 0;

	mapMarkers = [];
	mapLat = 35;
	mapLng = 37;
	mapZoom = 1;
	heatMap = undefined;
	@observable heatMapRadius = 20;
	map = undefined;
	@observable mapItemType = 'entity';
	mapCurrentPosition = undefined;
	mapCurrentPositionRadius = undefined;
	@observable currentPosition;
	currentPositionRadius;
	@observable mapPosition;
	@observable mapPositionLatLngText;
	@observable mapPositionRadius = 2000;
	@observable mapPositionRelativeRadius = 10;
	@observable mapPositionRelativeRadiusText = 10;
	@observable mapPositionUseRelativeRadius = true;
	@bindable mediaItemsAtLocation = [];

	filterMediaTypes = [
		{ key: 'article', name: 'Article', value: 'Article' },
		{ key: 'audio', name: 'Audio', value: 'Audio' },
		{ key: 'video', name: 'Video', value: 'Video' },
	];
	filterLanguages = [
		{ key: 'ar', value: "ar", short: "AR", name: 'Arabic' },
		{ key: 'en', value: "en", short: "EN", name: 'English' },
		{ key: 'de', value: "de", short: "DE", name: 'German' },
		{ key: 'lv', value: "lv", short: "LV", name: 'Latvian' },
		{ key: 'fa', value: "fa", short: "FA", name: 'Persian' },
		{ key: 'ru', value: "ru", short: "RU", name: 'Russian' },
		{ key: 'es', value: "es", short: "ES", name: 'Spanish' },
		{ key: 'uk', value: "uk", short: "UK", name: 'Ukrainian' },
	];
	// filterSettings = {
	filters = {
		mediaTypes: { article: true, audio: true, video: true },
		languages: { lv: true, en: true, de: true, ar: true, ru: true, es: true, fa: true, uk: true },
	};
	// filterSettings = { article: true, audio: true, video: true,// latest: undefined,
	// 	languages: { lv: true, en: true, de: true, ar: true, ru: true, es: true } };
	
	subscriptions = [];

	setAllProperties(obj, value) {
		for(let key of Object.keys(obj)) {
			obj[key] = value;
		}
	}

	restoreState(state) {
		console.log('RESTORE STATE:', state);
		if(!state) {
			// default state
			this.fromTag = fromTagDefault;
			this.tillTag = tillTagDefault;
			// this.selectedFeedGroups = [];
			// this.selectedEntities = [];
			this.selectedFeedGroups.splice(0, this.selectedFeedGroups.length);
			this.selectedEntities.splice(0, this.selectedEntities.length);
			this.setAllProperties(this.filters.mediaTypes, true);
			this.setAllProperties(this.filters.languages, true);
			this.fullTextSearch = '';
			this.active = 0;
			this.clusterID = undefined;
			this.topClusters = this.defaultClusterCount;
			this.perPage = 100;
			this.perPage2 = 50;
			this.clustersSortBy = 'size';
			this.page = 1;
			this.page2 = 1;
			// this.mapPositionRadius = undefined;
			this.mapPositionRelativeRadius = 10;
			this.currentPosition = undefined;
			this.mapItemType = 'entity';
			this.mapZoom = 1;
			return;
		}
		this.fromTag = 'date-time-';	// workaround
		this.tillTag = 'date-time-';	// workaround
		if(!state.from || state.from.length === 0) {
			this.fromTag = fromTagDefault;
		} else if(state.from[0] !== '@') {
			this.fromTag = state.from;
		} else {
			this.fromTag = 'date-time';
			this.timeFromString = state.from.substr(1);
		}
		if(!state.till || state.till.length === 0) {
			this.tillTag = tillTagDefault;
		} else if(state.till[0] !== '@') {
			this.tillTag = state.till;
		} else {
			this.tillTag = 'date-time';
			this.timeTillString = state.till.substr(1);
			// this.timeTillString = moment(state.till.substr(1));//.format('YYYY-MM-DD HH:mm:ss');
		}
		if(state.entities instanceof Array) {
			// this.selectedEntities = state.entities;
			Array.prototype.splice.apply(this.selectedEntities, [0, this.selectedEntities.length].concat(state.entities));
		}
		if(state.feedGroups instanceof Array) {
			// this.selectedFeedGroups = state.feedGroups;
			Array.prototype.splice.apply(this.selectedFeedGroups, [0, this.selectedFeedGroups.length].concat(state.feedGroups));
		}
		if(state.feeds instanceof Array) {
			for(let feed of state.feeds) {
				if(typeof feed === 'object') {
					this.selectedFeedGroups.push({ name: 'Feed: ' + feed.name, feed: feed.id });
				} else if(typeof feed === 'string') {
					this.selectedFeedGroups.push({ name: 'Feed: '+this.allFeedNames[feed], feed: feed });
					// this.selectedFeedGroups.push({ name: 'Feed: '+feed, feed: feed });
				}
			}
		}
		if(!state.mediaTypes || state.mediaTypes.length == 0) {
			// this.setAllProperties(this.filters.mediaTypes, true);
			this.setAllProperties(this.filters.mediaTypes, false);
		} else {
			this.setAllProperties(this.filters.mediaTypes, false);
			for(let mediaType of state.mediaTypes) {
				this.filters.mediaTypes[mediaType] = true;
			}
		}
		if(!state.languages || state.languages.length == 0) {
			// this.setAllProperties(this.filters.languages, true);
			this.setAllProperties(this.filters.languages, false);
		} else {
			this.setAllProperties(this.filters.languages, false);
			for(let language of state.languages) {
				this.filters.languages[language] = true;
			}
		}
		if(state.fts && state.fts.length > 0) {
			this.fullTextSearch = state.fts;
		} else {
			this.fullTextSearch = '';
		}
		this.clusterID = state.cluster;
		this.topClusters = state.clusterCount;
		if(state.perPage) {
			this.perPage = state.perPage;
		}
		if(state.perPage2) {
			this.perPage2 = state.perPage2;
		}
		if(state.clustersSortBy) {
			this.clustersSortBy = state.clustersSortBy;
		}
		if(state.mapZoom) {
			this.mapZoom = state.mapZoom;
		}
		setTimeout(() => {
			if(state.geoType) {
				this.mapItemType = state.geoType;
			} else {
				this.mapItemType = 'entity';
			}
			if(state.geoRadius) {
				this.mapPositionRadius = state.geoRadius;
			} else {
				this.mapPositionRelativeRadius = 10;
				// this.mapPositionRadius = 0;
			}
			if(state.geoPosition) {
				this.currentPosition = new google.maps.LatLng(state.geoPosition.lat, state.geoPosition.lng);
				this.mapPlaceMarker(this.currentPosition);
				this.mapLat = state.geoPosition.lat;
				this.mapLng = state.geoPosition.lng;
			} else {
				this.currentPosition = undefined;
			}
		}, 1000);
		setTimeout(() => {
			if(state.page) {
				this.page = state.page;
			}
			if(state.page2) {
				this.page2 = state.page2;
			}
		}, 0);
		if(state.active !== undefined) {
			if(state.active == 'trending') {
				this.active = 0;
			} else if(state.active == 'list') {
				this.active = 1;
			} else if(state.active == 'cluster-treemap') {
				this.active = 2;
			} else if(state.active == 'cluster-list') {
				this.active = 3;
			} else if(state.active == 'geoloc') {
				this.active = 4;
			}
		}
		console.log('RESTORED STATE:', this.fromTag, this.timeFromString, this.tillTag, this.timeTillString, this.selectedFeedGroups);
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
		let feeds = [];
		for(let feedGroup of (override.selectedFeedGroups || this.selectedFeedGroups)) {
			if(typeof feedGroup === 'string') {
				feedGroups.push(feedGroup);
			} else if(typeof feedGroup == 'object') {
				if(feedGroup.id) {
					feedGroups.push(feedGroup.id);
				} else if(feedGroup.feeds) {
					Array.prototype.splice.apply(feeds, [feeds.length, 0].concat(feedGroup.feeds));
				} else if(feedGroup.feed) {
					feeds.push(feedGroup.feed);
				}
			}
		}
		feedGroups.sort();
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
		let fullTextSearch = override.fullTextSearch || this.fullTextSearch;
		let active = override.active !== undefined ? override.active : this.active;
		if(active == 0) {
			active = 'trending';
		} else if(active == 1) {
			active = 'list';
		} else if(active == 2) {
			active = 'cluster-treemap';
		} else if(active == 3) {
			active = 'cluster-list';
		} else if(active == 4) {
			active = 'geoloc';
		}
		let state = {
			entities: entities,
			feedGroups: feedGroups,
			feeds: feeds,
			from: from,
			till: till,
			mediaTypes: mediaTypes,
			languages: languages,
			active: active,
			fts: fullTextSearch,
			cluster: this.clusterID,
			clusterCount: this.topClusters,
			page: override.page || this.page,
			perPage: override.perPage || this.perPage,
			page2: override.page2 || this.page2,
			perPage2: override.perPage2 || this.perPage2,
			clustersSortBy: override.clustersSortBy || this.clustersSortBy,
			geoRadius: this.mapPositionRadius,
			geoPosition: this.currentPosition ? { lat: this.currentPosition.lat(), lng: this.currentPosition.lng() } : undefined,
			geoType: this.mapItemType,
			mapZoom: this.mapZoom,
		};
		console.log('PACKED STATE:', state);
		return state;
	}

	isDefaultState(override, state) {
		if(state) {
			// check state object
			// if(state.active != 'trending') {
			// 	return false;
			// }
			if(state.fts && state.fts.length > 0) {
				return false;
			}
			if(state.entities && state.entities.length > 0) {
				return false;
			}
			if(state.feedGroups && state.feedGroups.length > 0) {
				return false;
			}
			if(state.till != 'now') {
				return false;
			}
			if(state.from != '-24h') {
				return false;
			}
			if(state.cluster) {
				return false;
			}
			if(state.clusterCount != this.defaultClusterCount) {
				return false;
			}
			if(!state.page || state.page != 1) {
				return false;
			}
			if(!state.page2 || state.page != 2) {
				return false;
			}
			if(!state.perPage || state.perPage != 100) {
				return false;
			}
			if(!state.perPage2 || state.perPage2 != 50) {
				return false;
			}
			if(!state.clustersSortBy || state.clustersSortBy != 'size') {
				return false;
			}
			if(state.geoRadius && state.geoRadius > 0) {
				return false;
			}
			if(state.geoPosition && state.geoPosition.lat !== undefined && state.geoPosition.lng !== undefined) {
				return false;
			}
			if(state.geoType != 'entity') {
				return false;
			}
			if(state.mapZoom != 1) {
				return false;
			}
			if(state.mediaTypes && state.mediaTypes.length > 0) {
				let test = Object.assign({}, this.filters.mediaTypes);
				this.setAllProperties(test, false);
				for(let mediaType of state.mediaTypes) {
					test[mediaType] = true;
				}
				for(let mediaType of Object.keys(test)) {
					if(!test[mediaType]) {
						return false;
					}
				}
			}
			if(state.languages && state.languages.length > 0) {
				let test = Object.assign({}, this.filters.languages);
				this.setAllProperties(test, false);
				for(let language of state.languages) {
					test[language] = true;
				}
				for(let language of Object.keys(test)) {
					if(!test[language]) {
						return false;
					}
				}
			}
			return true;
		} else {
			if(override && override.clusterID || this.clusterID) {
				return false;
			}
			if(override && override.clusterCount || override.clusterCount != this.defaultClusterCount) {
				return false;
			}
			if(!override) {
				override = {};
			}
			// check current unpacked state
			// if((override.active !== undefined ? override.active : this.active) != 0) {
			// 	return false;
			// }
			if((override.fullTextSearch && override.fullTextSearch.length > 0) || (this.fullTextSearch && this.fullTextSearch.length > 0)) {
				return false;
			}
			if((override.selectedEntities && override.selectedEntities.length > 0)
				|| (this.selectedEntities && this.selectedEntities.length > 0)) {
				return false;
			}
			if((override.selectedFeedGroups && override.selectedFeedGroups.length > 0)
				|| (this.selectedFeedGroups && this.selectedFeedGroups.length > 0)) {
				return false;
			}
			if((override.tillTag || this.tillTag) != 'now') {
				return false;
			}
			if((override.fromTag || this.fromTag != '-24h')) {
				return false;
			}
			if((override.page || this.page) != 1) {
				return false;
			}
			if((override.page2 || this.page) != 2) {
				return false;
			}
			if((override.perPage || this.perPage) != 100) {
				return false;
			}
			if((override.perPage2 || this.perPage2) != 50) {
				return false;
			}
			if((override.clustersSortBy || this.clustersSortBy) != 'size') {
				return false;
			}
			if(override.geoRadius && override.geoRadius > 0) {
				return false;
			}
			if(override.geoPosition && override.geoPosition.lat !== undefined && override.geoPosition.lng !== undefined) {
				return false;
			}
			if(override.mapZoom != 1) {
				return false;
			}
			let last = undefined;
			let mediaTypes = (override.filterMediaTypes || this.filters.mediaTypes);
			for(let mediaType of Object.keys(mediaTypes)) {
				let value = mediaTypes[mediaType];
				if(last === undefined) {
					last = value;
				} else if(last != value) {
					return false;
				}
				// if(!value) {
				// 	return false;
				// }
			}
			last = undefined;
			let languages = (override.filterLanguages || this.filters.languages)
			for(let language of Object.keys(languages)) {
				let value = languages[language];
				if(last === undefined) {
					last = value;
				} else if(last != value) {
					return false;
				}
				// if(!value) {
				// 	return false;
				// }
			}
			return true;
		}
	}

	updateFetchQueryEntities() {
		let entities = this.fetchQuery.entities = [];
		if(this.selectedEntities && this.selectedEntities.length > 0) {
			for(let entity of this.selectedEntities) {
				if(typeof entity == 'string') {
					entities.push(entity);
				} else if(entity && entity.id && entity.id.length > 0) {
					entities.push({id: entity.id});
				} else if(entity && entity.baseForm && entity.baseForm.length > 0) {
					entities.push(entity.baseForm);
				}
			}
		}
	}

	updateFetchQueryFeedGroups() {
		let feedGroups = this.fetchQuery.feedGroups = [];
		let feeds = this.fetchQuery.feeds = [];
		if(this.selectedFeedGroups && this.selectedFeedGroups.length > 0) {
			for(let feedGroup of this.selectedFeedGroups) {
				if(typeof feedGroup == 'string') {
					feedGroups.push(feedGroup);
				} else if(typeof feedGroup == 'object') {
					if(feedGroup && feedGroup.id && feedGroup.id.length > 0) {
						feedGroups.push(feedGroup.id);
					} else if(feedGroup.feed) {
						feeds.push(typeof feedGroup.feed === 'object' ? feedGroup.feed.id : feedGroup.feed);
					} else if(feedGroup.feeds instanceof Array) {
						// Array.prototype.splice.apply(feeds, [feeds.length, 0].concat(feedGroup.feeds));
						for(let feed of feedGroup.feeds) {
							feeds.push(typeof feedGroup.feed === 'object' ? feedGroup.feed.id : feedGroup.feed);
						}
					}
				}
			}
		}
	}

	getFromDate(relativeTo) {
		if(this.fromTag == 'date-time' || this.fromTag == 'date') {
			return moment(this.timeFromString);
		} else if(!this.fromTag) {
			return relativeDate('-24h', relativeTo);
		} else {
			return relativeDate(this.fromTag, relativeTo);
			// return relativeDate('-'+this.fromTag, relativeTo);
		}
	}

	getTillDate(relativeTo) {
		if(this.tillTag == 'date-time' || this.tillTag == 'date') {
			return moment(this.timeTillString);
		} else if(!this.tillTag || this.tillTag == 'now') {
			return moment(new Date());	// now
		} else {
			return relativeDate(this.tillTag, relativeTo);
			// return relativeDate('-'+this.tillTag, relativeTo);
		}
	}

	updateFetchQueryTimeRange() {
		if(this.fromTag == 'date-time' || this.fromTag == 'date') {
			this.fetchQuery.from = moment(this.timeFromString).utc();
		} else if(!this.fromTag) {
			this.fetchQuery.from = undefined;
		} else {
			this.fetchQuery.from = this.fromTag;
			// this.fetchQuery.from = '-'+this.fromTag;
		}
		if(this.tillTag == 'date-time' || this.tillTag == 'date') {
			this.fetchQuery.till = moment(this.timeTillString).utc();
		} else if(!this.tillTag || this.tillTag == 'now') {
			this.fetchQuery.till = this.tillTag;
		} else {
			this.fetchQuery.till = this.tillTag;
			// this.fetchQuery.till = '-'+this.tillTag;
		}
	}

	updateFetchQueryClusterID() {
		this.fetchQuery.cluster = this.clusterID;
	}

	updateFetchQueryWindow() {
		if(this.active == 1) {
			this.fetchQuery.limit = this.perPage;
			this.fetchQuery.offset = this.perPage * (this.page-1);
		} else if(this.active == 3) {
			this.fetchQuery.limit = this.perPage2;
			this.fetchQuery.offset = this.perPage2 * (this.page2-1);
		}
	}

	updateFetchQuerySortBy() {
		this.fetchQuery.sortBy = this.clustersSortBy;
	}

	updateFetchQueryClusterCount() {
		this.fetchQuery.clusters = this.topClusters;
	}

	updateFetchQueryGeolocation() {
		if(this.currentPosition) {
			this.fetchQuery.geoloc = { lat: this.currentPosition.lat(), lng: this.currentPosition.lng(), radius: this.mapPositionRadius || undefined };
		} else {
			delete this.fetchQuery.geoloc;
		}
	}

	updateFetchQueryFilters() {
		this.fetchQuery.mediaTypes = [];
		for(let mediaType of this.filterMediaTypes) {
			if(this.filters.mediaTypes[mediaType.key]) {
				this.fetchQuery.mediaTypes.push(mediaType.value);
			}
		}
		this.fetchQuery.languages = [];
		for(let language of this.filterLanguages) {
			if(this.filters.languages[language.key]) {
				this.fetchQuery.languages.push(language.value);
			}
		}
	}

	updateFetchQueryFTS() {
		this.fetchQuery.fullTextSearch = this.fullTextSearch;
	}

	prepareFetchQuery() {
		this.fetchQuery = {
			entities: [],
			feedGroups: [],
			offset: 0,
			limit: 100,
			languages: [],
			types: [],
			sortBy: 'size',
		};
		this.updateFetchQueryEntities();
		this.updateFetchQueryFeedGroups();
		this.updateFetchQueryTimeRange();
		this.updateFetchQueryFilters();
	}

	// @observable selectedQuery;
	// newQueryModal = undefined;
	// editQueryModal = undefined;

	// @bindable query = { namedEntities: [], feedGroups: [], from: { }, till: {} };
	// @bindable query = { namedEntities: [], feedGroups: [] };
	// fetchQuery = {
	// 	entities: [],
	// 	feedGroups: [],
	// 	offset: 0,
	// 	limit: 100,
	// };

	constructor(store, router, compositionService, services, bindingEngine, animator) {
		this.store = store;
		this.router = router;
		this.compositionService = compositionService;
		this.services = services;
		this.bindingEngine = bindingEngine;
		this.animator = animator;

		this.prepareFetchQuery();

		// this.queriesPromise = this.store.getQueries().then(queries => this.allQueries = queries);
		this.queriesPromise = this.store.getQueries().then(queries => { this.allQueries = queries; });
		// if(!this.store.namedEntities || this.store.namedEntities.length == 0) {
		// 	this.entitiesPromise = this.store.getNamedEntities();
		// } else {
		// 	this.entitiesPromise = Promise.resolve(this.store.namedEntities);
		// }

		this.feedGroupsPromise = this.store.getFeedGroups().then(feedGroups => {
			this.allFeedGroups = feedGroups;
			this.allFeedGroupNames = {};
			for(let feedGroup of feedGroups) {
				this.allFeedGroupNames[feedGroup.id] = feedGroup.name;
			}
		});
		this.feedsPromise = this.store.getFeeds().then(feeds => {
			this.allFeeds = feeds;
			this.allFeedNames = {};
			for(let feed of feeds) {
				if (feed) {
					this.allFeedNames[feed.id] = feed.name;
				}
			}
		});
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
	}

	async activate(params, routeConfig) {
		this.params = params;
		console.log('ACTIVATE');

		await this.feedGroupsPromise;
		await this.feedsPromise;

		// fast
		/*
		if(this.services.query) {
			// TODO: search in queries list when queriesPromise...
			// this.selectQuery(this.services.query);
			this.selectedQuery = this.services.query;
			this.queriesPromise.then(queries => {
				if(this.selectedQuery) {
					let query = queries.find(query => query.id === this.selectedQuery.id);
					if(query) {
						// this.selectedQuery = query;
						this.selectQuery(query, true);
					}
				} else {
					this.selectQuery(undefined, true);
				}
			});
		}
		*/

		// moved to attached() because route is not yet correctly set up, so navigate does not work correctly from activate
		// if(params.queryID) {
		// 	// get from list by id
		// 	this.queriesPromise.then(queries => {
		// 		let query = queries.find(query => query.id === params.queryID);
		// 		if(query) {
		// 			this.selectQuery(query);
		// 		}
		// 	});
		// }
		//
		//
	


		// console.log(this.params.queryID)
        //
		setTimeout(() => {
			this.locationChanged();
		}, 100);

	}

	async locationChanged() {
		if(this.params.queryID === 'all') {
			// this.selectQuery();
			this.restoreState();
		} else if(this.params.queryID === 'all-list') {
			// this.selectQuery();
			this.restoreState();
			this.active = 1;
		} else if(this.params.queryID) {
			this.restoreState(decode(this.params.queryID));
			// let query = decode(this.params.queryID);
			// console.log('DECODED QUERY:', query);
			// this.selectQuery(query);

			// let queryID = this.params.queryID;
			// // get from list by id
			// this.queriesPromise.then(queries => {
			// 	let query = queries.find(query => query.id === queryID);
			// 	if(query) {
			// 		this.selectQuery(query);
			// 	}
			// });
		}
		this.fetchData();
	}

	async attached() {
		console.log('TRENDING ATTACHED');
		// await this.entitiesPromise;	// wait for entities first
		// moved from activate() because route was not correctly set up, so navigate does not work correctly from activate
		
		this.fromPresetValues = jQuery(this.fromElement).children('option').map((i, v) => v.value).toArray();
		this.tillPresetValues = jQuery(this.tillElement).children('option').map((i, v) => v.value).toArray();



		/*
		if(this.params.queryID === 'all') {
			// this.selectQuery();
			this.restoreState();
		} else if(this.params.queryID === 'all-list') {
			// this.selectQuery();
			this.restoreState();
			this.active = 1;
		} else if(this.params.queryID) {
			this.restoreState(decode(this.params.queryID));
			// let query = decode(this.params.queryID);
			// console.log('DECODED QUERY:', query);
			// this.selectQuery(query);

			// let queryID = this.params.queryID;
			// // get from list by id
			// this.queriesPromise.then(queries => {
			// 	let query = queries.find(query => query.id === queryID);
			// 	if(query) {
			// 		this.selectQuery(query);
			// 	}
			// });
		}

		this.fetchData();
		*/

		this.selectedEntitiesSubscription = this.bindingEngine.collectionObserver(this.selectedEntities)
			.subscribe(this.selectedEntitiesChanged.bind(this));
		this.selectedFeedGroupsSubscription = this.bindingEngine.collectionObserver(this.selectedFeedGroups)
			.subscribe(this.selectedFeedGroupsChanged.bind(this));

		// let cb = () => this.filterSettingsChanged();
		// this.observeObjectProperties(this.filterSettings, cb);
		// this.observeObjectProperties(this.filterSettings.languages, cb);
		let cb = () => this.filtersChanged();
		this.observeObjectProperties(this.filters.mediaTypes, cb);
		this.observeObjectProperties(this.filters.languages, cb);

		// this.queryNamedEntitiesSubscription = this.bindingEngine.collectionObserver(this.query.namedEntities).subscribe(this.queryNamedEntitiesChanged);
		// this.queryFeedGroupsSubscription = this.bindingEngine.collectionObserver(this.query.feedGroups).subscribe(this.queryFeedGroupsChanged);
		// this.subscribeQueryNamedEntities();
		// this.subscribeQueryFeedGroups();

		jQuery('.selectpicker').selectpicker();
		let self = this;
		function selectedFeedsChangeHandler(e, index, select, prev) {
			if(!self.feedSelectElementUpdateToView) {
				let items = [];
				let viewItems = jQuery(this).selectpicker('val');
				let deselect = !select ? prev[index] : undefined;
				if(deselect) {
					let p = deselect.split(':');
					if(p[0] == 's-group') {
						viewItems.splice(viewItems.indexOf('group:'+p[1]), 1);
					} else if(p[0] == 's-feed') {
						viewItems.splice(viewItems.indexOf('feed:'+p[1]), 1);
					}
				}
				for(let item of viewItems) {
					let parts = item.split(':');
					if(parts[0] === 'feed') {
						items.push({ name: 'Feed: '+self.allFeedNames[parts[1]], feed: parts[1] })
					} else if(parts[0] === 'group') {
						items.push({ name: self.allFeedGroupNames[parts[1]], id: parts[1] })
					}
				}
				self.selectedFeedGroups.splice.apply(self.selectedFeedGroups, [0, self.selectedFeedGroups.length].concat(items));
				// jQuery(this).selectpicker('refresh');
			}
		}
		jQuery(this.feedSelectElement).on('changed.bs.select', selectedFeedsChangeHandler);
		jQuery(this.feedSelectElement).on('shown.bs.select', function (e) {
			setTimeout(() => {
				let parent = jQuery(e.delegateTarget);
				let sbox = parent.find('.bs-searchbox');
				// sbox.append('<button>Deselect</button>');
			}, 0)
		});
		this.selectedFeedGroupsChanged(this.selectedFeedGroups);
		// jQuery(this.feedSelectElement).selectpicker('val', this.selectedFeedGroups || []);
	}

	async detached() {
		this.selectedEntitiesSubscription.dispose();
		this.selectedFeedGroupsSubscription.dispose();

		for(let subscription of this.subscriptions) {
			subscription.dispose();
		}

		if(this.map) {
			google.maps.event.clearListeners(this.map, 'zoom_changed');
		}

		if(this.heatMap) {
			this.heatMap.setMap(null);
			this.heatMap = undefined;
			this.map = undefined;
		}

		// this.queryNamedEntitiesSubscription.dispose();
		// this.queryNamedEntitiesSubscription = undefined;
		// this.queryFeedGroupsSubscription.dispose();
		// this.queryFeedGroupsSubscription = undefined;
	}

	observeObjectProperties(obj, callback) {
		for(let key of Object.keys(obj)) {
			let subscription = this.bindingEngine.propertyObserver(obj, key).subscribe(callback.bind(obj, key));
			this.subscriptions.push(subscription);
		}
	}

	/*
	subscribeQueryNamedEntities() {
		if(this.queryNamedEntitiesSubscription) {
			this.queryNamedEntitiesSubscription.dispose();
			this.queryNamedEntitiesSubscription = undefined;
		}
		if(this.query) {
			if(!this.query.namedEntities)
				this.query.namedEntities = [];
			this.queryNamedEntitiesSubscription = this.bindingEngine.collectionObserver(this.query.namedEntities)
				.subscribe(this.queryNamedEntitiesChanged.bind(this));
		}
	}

	subscribeQueryFeedGroups() {
		if(this.queryFeedGroupsSubscription) {
			this.queryFeedGroupsSubscription.dispose();
			this.queryFeedGroupsSubscription = undefined;
		}
		if(this.query) {
			if(!this.query.feedGroups)
				this.query.feedGroups = [];
			this.queryFeedGroupsSubscription = this.bindingEngine.collectionObserver(this.query.feedGroups)
				.subscribe(this.queryFeedGroupsChanged.bind(this));
		}
	}
	*/


	/*
	async newQuery() {
		let query = await this.services.newQuery();
		if(query) {
			this.allQueries = await this.store.getQueries();
			// this.selectQuery(query);
			this.router.navigateToRoute('query-trending-id', { queryID: query.id }, { trigger: true });	// to query trending view
			// this.router.navigateToRoute('stories', { queryID: query.id }, { trigger: true }); // to stories view
		}
	}
	*/

	async pinCurrentQuery() {
		let name = prompt("Please enter name for the query", "Query "+(this.allQueries.length+1));
		if(!name) {
			return;
		}
		// let query = await this.services.newQuery();
		// take current this.query and save
		// this.query.name = name;
		let mediaTypes = [];
		for(let mediaType of this.filterMediaTypes) {
			if(this.filters.mediaTypes[mediaType.key]) {
				mediaTypes.push(mediaType.value);
			}
		}
		let languages = [];
		for(let language of this.filterLanguages) {
			if(this.filters.languages[language.key]) {
				languages.push(language.value);
			}
		}
		let active = 'trending';
		if(this.active == 0) {
			active = 'trending';
		} else if(this.active == 1) {
			active = 'list';
		} else if(this.active == 2) {
			active = 'cluster-treemap';
		} else if(this.active == 3) {
			active = 'cluster-list';
		} else if(this.active == 4) {
			active = 'geoloc';
		}
		let query = {
			name: name,
			from: this.fromTag == 'date-time' || this.fromTag == 'date' ? moment(this.timeFromString).toISOString() : this.fromTag,
			till: this.tillTag == 'date-time' || this.tillTag == 'date' ? moment(this.timeTillString).toISOString() : this.tillTag,
			entities: this.selectedEntities.slice(),
			feedGroups: this.selectedFeedGroups.slice(),
			mediaTypes: mediaTypes,
			languages: languages,
			active: active,
			fullTextSearch: this.fullTextSearch,
			clusterID: this.clusterID,
		};
		// let query = Object.assign({}, this.query);
		// query.name = name;
		// delete query.id;
		let r = await this.store.saveQuery(query);
		// let feedGroups = [];
		// for(let feedGroup of r.feedGroups) {
		// 	feedGroups.push(feedGroup.id)
		// }
		// r.feedGroups = feedGroups;
		console.log(r);
	}

	/*
	async editQuery(query) {
		log.debug('edit query:', query);
		if(query) {
			query = Object.assign({}, await this.store.getQuery(query.id));
		}
		log.debug('edit query:', query);
		// query = await this.editQueryModal(query);
		let [dialog, destroy] = await this.compositionService.create('dialogs/query-settings-dialog');
		dialog.viewModel.remove = (params) => { this.removeQuery(params.$model); };
		query = await dialog.viewModel.edit(query);
		destroy();

		if(query) {
			await this.store.saveQuery(query);
		}
	}
	*/

	async removeQuery(query, event) {
		if(event) {
			event.stopPropagation();
		}
		let [dialog, destroy] = await this.compositionService.create('dialogs/confirmation-dialog');
		// dialog.viewModel.remove = (params) => { this.removeUser(params.$model); };
		let result = await dialog.viewModel.open({
			title: `Delete Query`,
			body: `Are you sure you want to delete query ${query.name} ?`,
			btnClass: 'danger',
			btnTitle: 'Delete Query'
		});
		if(result) {
			try {
				log.debug('remove query:', query);
				let result = await this.store.removeQuery(query.id);
				// this.selectedQuery = undefined;
			} catch(e) {
				console.error(e);
			}
		}
	}

	/*
	defaultQuery(query) {
		return false;
		// TODO: check updated query etc, not current state
		return this.fromTag === fromTagDefault && this.tillTag == tillTagDefault
			&& this.selectedEntities.length === 0 && this.selectedFeedGroups.length === 0;
	}
	*/

	updateNavigation(override, action) {
		// console.log("UPDATE NAV:",query);
		// if(query && !this.defaultQuery(query))
		// if(this.fromTag === fromTagDefault && this.tillTag == tillTagDefault
		// 	&& this.selectedEntities.length === 0 && this.selectedFeedGroups.length === 0)
		// 	this.router.navigateToRoute('query-trending-id', { queryID: 'all' }, { trigger: false });	// default
		// else
		// 	this.router.navigateToRoute('query-trending-id', { queryID: encode(this.packState()) }, { trigger: false });
		if(!override) {
			override = {};
		}
		let state = 'all';
		if(!this.isDefaultState(override)) {
			console.log('STATE:', this.packState(override));
			state = encode(this.packState(override));
		} else 
		if((override.active !== undefined ? override.active : this.active) == 1) {
			state = 'all-list'
		}
		const route = 'query-trending-id';
		let url;
		if(action == 'url' || action == 'new') {
			url = this.router.generate(route, { queryID: state });
		}
		if(action == 'url') {
			return url;
		} else if(action == 'new') {
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute(route, { queryID: state }, { trigger: action == 'trigger' });
		}
	}

	async selectQuery(query, skipNavigation, event) {
		console.log('SELECT QUERY:', query)
		if(!query) {
			this.restoreState();
		} else {
			// this.selectedFeedGroups = query.feedGroups.splice();
			// this.selectedEntities = query.entities.splice();
			Array.prototype.splice.apply(this.selectedFeedGroups, [0, this.selectedFeedGroups.length].concat(query.feedGroups));
			Array.prototype.splice.apply(this.selectedEntities, [0, this.selectedEntities.length].concat(query.entities));
			this.tillTag = 'date-time-';
			this.fromTag = 'date-time-';
			if(isRelativeTag(query.till)) {
				this.tillTag = query.till;
			} else {
				this.tillTag = 'date-time';
				this.timeTillString = moment(query.till).format('YYYY-MM-DD HH:mm:ss');
			}
			if(isRelativeTag(query.from)) {
				this.fromTag = query.from;
			} else {
				this.fromTag = 'date-time';
				this.timeFromString = moment(query.from).format('YYYY-MM-DD HH:mm:ss');
			}
			if(!query.mediaTypes || query.mediaTypes.length == 0) {
				// this.setAllProperties(this.filters.mediaTypes, true);
				this.setAllProperties(this.filters.mediaTypes, false);
			} else {
				this.setAllProperties(this.filters.mediaTypes, false);
				// key -> value mapping
				let mapping = {};
				for(let mediaType of this.filterMediaTypes) {
					mapping[mediaType.value] = mediaType.key;
				}
				for(let mediaType of query.mediaTypes) {
					this.filters.mediaTypes[mapping[mediaType]] = true;
				}
			}
			if(!query.languages || query.languages.length == 0) {
				// this.setAllProperties(this.filters.languages, true);
				this.setAllProperties(this.filters.languages, false);
			} else {
				this.setAllProperties(this.filters.languages, false);
				// key -> value mapping
				let mapping = {};
				for(let language of this.filterLanguages) {
					mapping[language.value] = language.key;
				}
				for(let language of query.languages) {
					this.filters.languages[mapping[language]] = true;
				}
			}
			this.clusterID = query.clusterID;
			if(query.fullTextSearch && query.fullTextSearch.length > 0) {
				this.fullTextSearch = query.fullTextSearch;
			}
			if(query.active !== undefined) {
				if(query.active == 'trending') {
					this.active = 0;
				} else if(query.active == 'list') {
					this.active = 1;
				} else if(state.active == 'cluster-treemap') {
					this.active = 2;
				} else if(state.active == 'cluster-list') {
					this.active = 3;
				} else if(state.active == 'geoloc') {
					this.active = 4;
				}
			} else {
				this.active = 0;
			}
		}
		// this.query = Object.assign({}, query);
		// this.query = jQuery.extend(true, {}, query);
		// this.query = Object.assign({}, query);
		// this.query.feedGroups = Object.assign([], query.feedGroups)
		// this.selectedQuery = this.query;
		if(!skipNavigation) {
			this.updateNavigation(query);
		}
		if(event) {
			this.animator.animate(event.target, 'flash');
		}
		return
		/*
		if(!skipNavigation) {
			// change representing route
			// this.router.navigateToRoute('query-trending-id', { queryID: query.id }, { trigger: true });
			if(query)
				this.router.navigateToRoute('query-trending-id', { queryID: query.id }, { trigger: false });
			else
				this.router.navigateToRoute('query-trending-id', { queryID: 'all' }, { trigger: false });
		}

		log.debug('select query:', query);
		this.selectedQuery = query;
		this.trending = undefined;
		this.trendingForQueryInProgress = query && query.id;
		const trending = await this.store.getQueryTrending(query && query.id);
		if(this.trendingForQueryInProgress !== (query && query.id))
			return;
		// this.selectedQuery = Object.assign(this.selectedQuery, query);
		// trending = this.selectedQuery.trending;
		// console.log(trending)

		// function entityTrend(entity, trendObject) {
		// 	const bins = [];
		// 	let total = 0;
		// 	for(let i=0; i<24; ++i) {
		// 		total += bins[i] = trendObject[i-23 || '-0'] || 0;	// from -24 till 0
		// 		// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
		// 	}
		// 	return { entity, bins, total };
		// }
		function entityTrend(entity) {
			const bins = [];
			let total = 0;
			for(let i=0; i<24; ++i) {
				total += bins[i] = entity.bins[i-23 || '-0'] || 0;	// from -24 till 0
				// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
			}
			entity.bins = bins;
			entity.total = total;
			return entity;
			// return { entity, bins, total };
		}

		function trendsOfEntities(trendsObject) {
			const trends = [];
			// for(let entity of Object.keys(trendsObject)) {
			// 	trends.push(entityTrend(entity, trendsObject[entity]));
			for(let entity of trendsObject) {
				trends.push(entityTrend(entity));
			}
			return trends;
		}

		trending.selectedEntities = trendsOfEntities(trending.selectedEntities);
		trending.topKEntities = trendsOfEntities(trending.topKEntities);
		trending.topKEntities.sort((a, b) => {
			return b.total - a.total;
		});

		// if(this.selectedQuery)
		// 	this.selectedQuery.trending = trending;
		this.trending = trending;
		
		// console.log('query:', query)
		this.services.query = this.selectedQuery;

		// TODO: scroll into screen
		
		*/
	}

	/*
	storiesForQuery(query, event) {
		// if(!this.selectedQuery)
		// 	return true;
		if(!query) {
			query = { id: 'all' };
		}

		const route = 'stories';
		const params = { queryID: query.id };

		if(event !== undefined && (event === true || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)) {
			// use any modifier as and excuse to open in separate tab/window
			const url = this.router.generate(route, params);
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute(route, params, { trigger: true });
		}
	}
	*/

	selectBin(entity, binIndex, event) {
		const pastHour = -(binIndex-23);
		console.log('SELECT BIN:', entity, binIndex, pastHour);
		// if(!this.selectedEntities) {
		// 	this.selectedEntities = [];
		// }
		// Array.prototype.splice.apply(this.selectedFeedGroups, [0, this.selectedFeedGroups.length].concat(query.feedGroups));
		// Array.prototype.splice.apply(this.selectedEntities, [0, this.selectedEntities.length].concat(query.entities));
		
		let index;
		if(entity) {
			index = this.selectedEntities.findIndex((item, index, array) => {
				return typeof item === 'object' && item.id && entity.id === item.id ||
					entity.baseForm.toLowerCase() === (typeof item === 'string' ? item : item.baseForm).toLowerCase();
			});
		}

		let date;
		if(this.tillTag != 'date-time') {
			date = this.tillTag == 'now' ? moment(new Date()) : relativeDate(this.tillTag);
		} else {
			date = moment(this.timeTillString);
		}

		if(this.services.altTouch || event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) {

			let override = {};

			override.selectedEntities = this.selectedEntities.slice();

			if(entity) {
				if(index === -1) {
					override.selectedEntities.push(typeof entity == 'string' ? entity : { id: entity.id, baseForm: entity.baseForm });
				}
			}
			override.tillTag = 'date-time';
			override.fromTag = 'date-time';

			override.timeTillString = date.subtract(pastHour, 'hours').format('YYYY-MM-DD HH:mm:ss');
			override.timeFromString = moment(override.timeTillString).subtract(1, 'hours').format('YYYY-MM-DD HH:mm:ss');
			// this.timeFromString = date.subtract(pastHour+1, 'hours').format('YYYY-MM-DD HH:mm:ss');
			override.clusterID = undefined;
			override.active = 1;	// switch to list

			// use any modifier as and excuse to open in separate tab/window
			this.updateNavigation(override, 'new');

		} else {

			if(entity) {
				if(index === -1) {
					this.selectedEntities.push(entity);
					this.selectedEntity = '';
				}
			}
			
			// workaround to disable auto date time calculation
			this.tillTag = 'date-time-';
			this.fromTag = 'date-time-';

			this.tillTag = 'date-time';
			this.fromTag = 'date-time';

			this.timeTillString = date.subtract(pastHour, 'hours').format('YYYY-MM-DD HH:mm:ss');
			this.timeFromString = moment(this.timeTillString).subtract(1, 'hours').format('YYYY-MM-DD HH:mm:ss');
			// this.timeFromString = date.subtract(pastHour+1, 'hours').format('YYYY-MM-DD HH:mm:ss');
			this.clusterID = undefined;
			this.active = 1;	// switch to list

			this.updateNavigation(undefined, 'trigger');
		}
		return;



		// if(!this.selectedQuery)
		// 	return;
		// const pastHour = -(binIndex-23);
		// console.log(trend, binIndex-24);

		const params = {
			queryID: this.selectedQuery && this.selectedQuery.id || 'all',
			pastHour: this.trending.epochTimeSecs+'-'+pastHour,
			// entity: entity.baseForm,
			// entityID: entity.id,
			entity: entity.id,
			// entity: trend.entity
		};

		// console.log(this.trending.epochTimeSecs+'-'+pastHour);
		if(this.services.altTouch || event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) {
			// use any modifier as and excuse to open in separate tab/window
			const url = this.router.generate('hour-media-items', params);
			window.open(url, '_blank');
		} else {
			this.router.navigateToRoute('hour-media-items', params, { trigger: true });
		}
	}

	// --------------------------

	/*
	getEntity(baseForm) {
		if(this.store.namedEntities) {
			return this.store.namedEntities.find(entity => entity.baseForm == baseForm);
		}
	}
	*/

	addSelectedFeedGroup() {
		if(!this.selectedFeedGroup)
			return;
		// log.debug('add selected feed group:', this.selectedFeedGroup);
		if(!this.feedGroups) {
			this.feedGroups = [];
		}
		let index = this.feedGroups.findIndex((item, index, array) => {
			return this.selectedFeedGroup === item;
			// return this.selectedFeedGroup.id === item.id;
		});
		if(index === -1) {
		// if(this.feedGroups.indexOf(this.selectedFeedGroup) === -1) {
			this.selectedFeedGroups.push(this.selectedFeedGroup);
		} else {
			log.info('Feed group already added');
		}
		this.selectedFeedGroup = undefined;
	}

	entitySelected(event) {
		log.debug('entity selected:', event.value);
		log.debug('entity selected:', typeof event.value);
		this.selectedEntity = event.value;
		// if(!this.selectedEntities) {
		// 	this.selectedEntities = [];
		// }
		let index = this.selectedEntities.findIndex((item, index, array) => {
			if(typeof this.selectedEntity === 'string' && typeof item === 'string') {
				return this.selectedEntity === item;
			} else if(typeof this.selectedEntity === 'object' && typeof item === 'object') {
				if(this.selectedEntity.id) {
					return this.selectedEntity.id === item.id;
				} else {
					return this.selectedEntity.baseForm === item.baseForm;
				}
				// return this.selectedEntity.baseForm === item.baseForm;
			}
			return false;
			// return this.selectedEntity.baseForm === (typeof item === 'string' ? item : item.baseForm);
		});
		if(index === -1) {
		// if(this.selectedEntities.indexOf(this.selectedEntity) === -1) {
			this.selectedEntities.push(this.selectedEntity);
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

	// --------------------------

	/*
	// async refreshData(query, getTrending, getList) {
	async refreshData(query, state) {

		if(state === undefined) {
			state = this.active;
		}

		let getTrending = state === 0;
		let getList = state === 1;

		if(getTrending) {

			let trending = await this.store.getTrending(query);
			this.trending = undefined;
			// this.trendingForQueryInProgress = query && query.id;
			// const trending = await this.store.getQueryTrending(query && query.id);
			// if(this.trendingForQueryInProgress !== (query && query.id))
			// 	return;
			// this.selectedQuery = Object.assign(this.selectedQuery, query);
			// trending = this.selectedQuery.trending;
			// console.log(trending)

			// function entityTrend(entity, trendObject) {
			// 	const bins = [];
			// 	let total = 0;
			// 	for(let i=0; i<24; ++i) {
			// 		total += bins[i] = trendObject[i-23 || '-0'] || 0;	// from -24 till 0
			// 		// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
			// 	}
			// 	return { entity, bins, total };
			// }
			function entityTrend(entity) {
				const bins = [];
				let total = 0;
				for(let i=0; i<24; ++i) {
					total += bins[i] = entity.bins[i-23 || '-0'] || 0;	// from -24 till 0
					// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
				}
				entity.bins = bins;
				entity.total = total;
				return entity;
				// return { entity, bins, total };
			}

			function trendsOfEntities(trendsObject) {
				const trends = [];
				// for(let entity of Object.keys(trendsObject)) {
				// 	trends.push(entityTrend(entity, trendsObject[entity]));
				for(let entity of trendsObject) {
					trends.push(entityTrend(entity));
				}
				return trends;
			}

			trending.selectedEntities = trendsOfEntities(trending.selectedEntities);
			trending.topKEntities = trendsOfEntities(trending.topKEntities);
			trending.topKEntities.sort((a, b) => {
				return b.total - a.total;
			});

			// if(this.selectedQuery)
			// 	this.selectedQuery.trending = trending;
			this.trending = trending;
		}

		if(getList) {

			let response = await this.store.getMediaItems(query);
			this.totalCount = response.totalCount;
			this.mediaItems = response.mediaItems;
			// console.log('MEDIA ITEMS:', this.mediaItems);

			let allTopics = {};
			for(const mediaItem of this.mediaItems) {
				let detectedTopics = {};
				for(const [topic, confidence] of mediaItem.detectedTopics) {
					// console.log(topic, confidence);
					// detectedTopics[topic] = confidence;
					detectedTopics[topic] = true;
					if(!allTopics[topic]) {
						allTopics[topic] = { count: 1, confidence, label: topic };
					} else {
						allTopics[topic].count += 1;
						allTopics[topic].confidence += confidence;
					}
				}
				mediaItem.detectedTopicsPresent = detectedTopics;
			}
			let allTopicsArray = [];
			for(let topic of Object.keys(allTopics)) {
				topic = allTopics[topic];
				topic.confidence /= topic.count;
				// allTopicsArray.push([ topic.name, topic.confidence, topic.count, selected: false ]);
				topic.selected = false;
				allTopicsArray.push(topic);
			}
			// this.allTopics = allTopicsArray.sort((a, b) => b[1] - a[1]);
			// this.allTopics = allTopicsArray.sort((a, b) => b.confidence - a.confidence);
			this.allTopics = allTopicsArray.sort((a, b) => (b.count - a.count) || (b.confidence - a.confidence));	// first by count, then by confidence
		}
	}
	*/

	async activeChanged(active) {
		console.log('ACTIVE:', active);
		// await this.refreshData(this.fetchQuery);
		await this.fetchData();
	}

	/*
	queryChanged(query) {
		this.updateNavigation(query);
		this.subscribeQueryNamedEntities();
		this.subscribeQueryFeedGroups();
		console.log('QUERY:', query);
		if(this.query) {
			this.queryNamedEntitiesChanged(this.query.namedEntities);
			this.queryFeedGroupsChanged(this.query.feedGroups);
		}
		this.refreshData(this.fetchQuery);
	}
	*/

	/*
	queryNamedEntitiesChanged(value) {
		this.updateNavigation(this.query);
		// console.log('NAMED ENTITIES:', value);
		// console.log('NAMED ENTITIES:', value);
		console.log('NAMED ENTITIES:',this.query.namedEntities);
		let entities = [];
		if(this.query.namedEntities) {
			for(let entity of this.query.namedEntities) {
				if(typeof entity == 'string') {
					entities.push(entity);
				} else if(entity.id && entity.id.length > 0) {
					entities.push({id: entity.id});
				}
			}
		}
		this.fetchQuery.entities = entities;
		this.refreshData(this.fetchQuery);
	}

	queryFeedGroupsChanged(value) {
		this.updateNavigation(this.query);
		// console.log('FEED GROUPS:', value);
		console.log('FEED GROUPS:', this.query.feedGroups);
		let feedGroups = [];
		if(this.query.feedGroups) {
			for(let feedGroup of this.query.feedGroups) {
				// feedGroups.push(feedGroup.id);
				feedGroups.push(feedGroup);
			}
		}
		this.fetchQuery.feedGroups = feedGroups;
		this.refreshData(this.fetchQuery);
	}
	*/

	async selectMediaItem(mediaItem) {
		// change representing route
		// this.router.navigateToRoute('story-media-item-id', { queryID: this.query.id, storyID: story.id, mediaItemID: mediaItem.id }, { trigger: false });

		this.selectedMediaItem = mediaItem;
		// NOTE: scroll into screen not needed if above is uncommented (no way to select specific story by URL
		this.services.mediaItem = this.selectedMediaItem;
	}

	async viewMediaItem(mediaItem, event) {
		// current route name: this.routeConfig.name
		let route;
		const params = {
				// pastHour: this.params.pastHour,
				mediaItemID: mediaItem.id
		};
		// if(this.params.queryID) {
		//		params.queryID = this.params.queryID;
		//		params.entity = this.params.entity;
		//		route = 'hour-media-item';
		// } else if(this.params.feedID) {
		//		params.feedID = this.params.feedID;
		//		route = 'feed-hour-media-item';
		// }
		route = 'media-item'

		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
				// use any modifier as and excuse to open in separate tab/window
				const url = this.router.generate(route, params);
				window.open(url, '_blank');
		} else {
				this.router.navigateToRoute(route, params, { trigger: true });
		}
	}

	async viewListCluster(cluster, event) {
		this.selectCluster(cluster.id);
	}

	async selectListCluster(cluster) {
		// change representing route
		// this.router.navigateToRoute('story-media-item-id', { queryID: this.query.id, storyID: story.id, mediaItemID: mediaItem.id }, { trigger: false });

		this.selectedListCluster = cluster;
		// NOTE: scroll into screen not needed if above is uncommented (no way to select specific story by URL
		// this.services.cluster = this.selectedListCluster;
	}


	async fetchDataNow(active) {

		this.updateFetchQueryFeedGroups();
		this.updateFetchQueryEntities();
		this.updateFetchQueryFilters();
		this.updateFetchQueryTimeRange();
		this.updateFetchQueryWindow();
		this.updateFetchQuerySortBy();
		this.updateFetchQueryFTS();
		this.updateFetchQueryClusterID();
		this.updateFetchQueryClusterCount();
		delete this.fetchQuery.geoloc;

		console.log('FETCH QUERY:', this.fetchQuery);

		if(active === undefined) {
			active = this.active;
		}

		let getTrending = active === 0;
		let getList = active === 1;
		let getClustersByTopic = active === 2;
		let getClusters = active === 3;
		let getGeolocationData = active === 4;

		let fetchQuery = Object.assign({}, this.fetchQuery);

		if(!getList && fetchQuery.cluster !== undefined) {
			// fetchQuery.cluster = undefined;
			delete fetchQuery.cluster;
		}

		if(getTrending) {

			let trending = await this.store.getTrending(fetchQuery);
			this.trending = undefined;
			// this.trendingForQueryInProgress = query && query.id;
			// const trending = await this.store.getQueryTrending(query && query.id);
			// if(this.trendingForQueryInProgress !== (query && query.id))
			// 	return;
			// this.selectedQuery = Object.assign(this.selectedQuery, query);
			// trending = this.selectedQuery.trending;
			// console.log(trending)

			// function entityTrend(entity, trendObject) {
			// 	const bins = [];
			// 	let total = 0;
			// 	for(let i=0; i<24; ++i) {
			// 		total += bins[i] = trendObject[i-23 || '-0'] || 0;	// from -24 till 0
			// 		// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
			// 	}
			// 	return { entity, bins, total };
			// }
			
			function binsToArray(binsObject) {
				const bins = [];
				let total = 0;
				for(let i=0; i<24; ++i) {
					total += bins[i] = binsObject[i-23 || '-0'] || 0;	// from -24 till 0
					// total += bins[i] = binsObject[-i || '-0'] || 0;	// from 0 till -24
				}
				return { bins, total };
			}

			function entityTrend(entity) {
				const bins = [];
				let total = 0;
				for(let i=0; i<24; ++i) {
					total += bins[i] = entity.bins[i-23 || '-0'] || 0;	// from -24 till 0
					// total += bins[i] = trendObject[-i || '-0'] || 0;	// from 0 till -24
				}
				entity.bins = bins;
				entity.total = total;
				return entity;
				// return { entity, bins, total };
			}

			function trendsOfEntities(trendsObject) {
				const trends = [];
				// for(let entity of Object.keys(trendsObject)) {
				// 	trends.push(entityTrend(entity, trendsObject[entity]));
				for(let entity of trendsObject) {
					trends.push(entityTrend(entity));
				}
				return trends;
			}

			if(trending.totalBins) {
				trending.totalBins = binsToArray(trending.totalBins);
			}
			trending.selectedEntities = trendsOfEntities(trending.selectedEntities);
			trending.topKEntities = trendsOfEntities(trending.topKEntities);
			trending.topKEntities.sort((a, b) => {
				return b.total - a.total;
			});

			// if(this.selectedQuery)
			// 	this.selectedQuery.trending = trending;
			this.trending = trending;
		}

		if(getList) {

			let response = await this.store.getMediaItems(fetchQuery);
			this.totalCount = response.totalCount;
			this.totalPages = Math.ceil(this.totalCount / this.perPage);
			this.mediaItems = response.mediaItems;
			this.highlights = response.highlights;
			// console.log('MEDIA ITEMS:', this.mediaItems);

			let allTopics = {};
			for(const mediaItem of this.mediaItems) {
				let detectedTopics = {};
				for(const [topic, confidence] of mediaItem.detectedTopics) {
					// console.log(topic, confidence);
					// detectedTopics[topic] = confidence;
					detectedTopics[topic] = true;
					if(!allTopics[topic]) {
						allTopics[topic] = { count: 1, confidence, label: topic };
					} else {
						allTopics[topic].count += 1;
						allTopics[topic].confidence += confidence;
					}
				}
				mediaItem.detectedTopicsPresent = detectedTopics;
			}
			let allTopicsArray = [];
			for(let topic of Object.keys(allTopics)) {
				topic = allTopics[topic];
				topic.confidence /= topic.count;
				// allTopicsArray.push([ topic.name, topic.confidence, topic.count, selected: false ]);
				topic.selected = false;
				allTopicsArray.push(topic);
			}
			// this.allTopics = allTopicsArray.sort((a, b) => b[1] - a[1]);
			// this.allTopics = allTopicsArray.sort((a, b) => b.confidence - a.confidence);
			this.allTopics = allTopicsArray.sort((a, b) => (b.count - a.count) || (b.confidence - a.confidence));	// first by count, then by confidence
		}

		if(getClustersByTopic) {

			let clusters = await this.store.getClusters(fetchQuery, true);

			this.clusters = clusters;
		}

		if(getClusters) {
			let response = await this.store.getClusters(fetchQuery, false);
			this.totalCount2 = response.totalCount;
			this.totalPages2 = Math.ceil(this.totalCount2 / this.perPage2);
			this.allClusters = response.clusters;
		}

		if(getGeolocationData) {
			if(this.map) {
				this.updateFetchQueryGeolocation();
				// fetchQuery.geoloc = undefined;
				let LatLng = google.maps.LatLng
				fetchQuery.limit = 0;
				fetchQuery.offset = 0;
				let response = await this.store.getEntitiesWithGeolocationInfo(fetchQuery, this.mapItemType);
				let data = [];
				for(let item of response) {
					data.push(new LatLng(item.geoloc.lat, item.geoloc.lng));
				}
				if(this.heatMap) {
					this.heatMap.set('radius', this.heatMapRadius);
					this.heatMap.setData(data);
				} else {
					this.heatMap = new google.maps.visualization.HeatmapLayer({
						data: data,
						map: this.map,
						radius: this.heatMapRadius,
					});
				}

				if(this.currentPosition) {
					await this.fetchMediaItemsAtLocation();
				}
			}
		}
	}

	async fetchMediaItemsAtLocationNow() {
		if(!this.currentPosition) {
			this.mediaItemsAtLocation = [];
			return;
		}

		this.updateFetchQueryFeedGroups();
		this.updateFetchQueryEntities();
		this.updateFetchQueryFilters();
		this.updateFetchQueryTimeRange();
		this.updateFetchQueryWindow();
		this.updateFetchQuerySortBy();
		this.updateFetchQueryFTS();
		this.updateFetchQueryClusterID();
		this.updateFetchQueryClusterCount();
		this.updateFetchQueryGeolocation();

		this.fetchQuery.limit = 0;
		this.fetchQuery.offset = 0;

		let fetchQuery = Object.assign({}, this.fetchQuery);
		this.fetchQuery.geoloc.items = this.mapItemType;

		delete fetchQuery.cluster;

		let response = await this.store.getMediaItems(fetchQuery);
		this.mediaItemsAtLocation = response.mediaItems;
	}

	async fetchMediaItemsAtLocation() {
		if(!this.fetchTimeout2) {
			clearTimeout(this.fetchTimeout2);
		}
		this.fetchTimeout2 = setTimeout(() => {
			this.updateNavigation();
			this.fetchMediaItemsAtLocationNow();
			this.fetchTimeout2 = undefined;
		}, 500);
		// if(!this.waitingForFetch2) {
		// 	 setTimeout(() => {
		// 		this.updateNavigation();
		// 		this.fetchMediaItemsAtLocationNow();
		// 		this.waitingForFetch2 = false;
		// 	}, 100);
		// 	this.waitingForFetch2 = true;
		// }
	}

	async fetchData(active) {
		console.log("FETCH DATA TILL STRING:", this.timeTillString)
		if(!this.fetchTimeout) {
			clearTimeout(this.fetchTimeout);
		}
		this.fetchTimeout = setTimeout(() => {
			this.updateNavigation();
			this.fetchDataNow(active);
			this.fetchTimeout = undefined;
		}, 100);
		// if(!this.waitingForFetch) {
		// 	this.fetchTimeout = setTimeout(() => {
		// 		this.updateNavigation();
		// 		this.fetchDataNow(active);
		// 		this.waitingForFetch = false;
		// 	}, 100);
		// 	this.waitingForFetch = true;
		// }
	}

	async selectedEntitiesChanged(value) {
		console.log('SELECTED ENTITIES:', this.selectedEntities)
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryEntities();
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async selectedFeedGroupsChanged(value) {
		this.feedSelectElementUpdateToView = true;
		let items = [];
		for(let item of this.selectedFeedGroups) {
			if(typeof item === 'string') {
				items.push('group:'+item);
				// items.push('s-group:'+item);
			} else if(item.id && item.id.length > 0) {
				items.push('group:'+item.id);
				// items.push('s-group:'+item.id);
			} else if(item.feed && item.feed.length > 0) {
				items.push('feed:'+item.feed);
				// items.push('s-feed:'+item.feed);
			}
		}
		jQuery(this.feedSelectElement).selectpicker('val', items);
		// jQuery(this.feedSelectElement).selectpicker('refresh');
		this.feedSelectElementUpdateToView = false;

		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryFeedGroups();
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async pageChanged(value) {
		// console.log('PAGE:', value);
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async page2Changed(value) {
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async perPageChanged(value) {
		this.totalPages = Math.ceil(this.totalCount / this.perPage);
		this.page = 1;
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async perPage2Changed(value, oldValue) {
		this.totalPages2 = Math.ceil(this.totalCount2 / this.perPage2);
		this.page2 = 1;
		this.updateFetchQueryWindow();
		await this.fetchData();
	}

	async clustersSortByChanged(value) {
		this.page2 = 1;
		this.updateFetchQuerySortBy();
		await this.fetchData();
	}

	async timeFromStringChanged(timeFrom) {
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryWindow();
		this.updateFetchQueryTimeRange();
		await this.fetchData();
	}

	async timeTillStringChanged(timeTill) {
		console.log("TILL STRING:", timeTill, this.timeTillString)
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryWindow();
		this.updateFetchQueryTimeRange();
		await this.fetchData();
	}

	async fromTagChanged(value, oldValue) {
		if((value == 'date' || value == 'date-time') && (oldValue != 'date' && oldValue != 'date-time' && oldValue != 'date-time-')) {
			let date = relativeDate(oldValue, this.getTillDate());
			// this.timeFromString = date.toISOString().replace('T', ' ');
			this.timeFromString = date.format('YYYY-MM-DD HH:mm:ss');
			console.log('FROM:', oldValue, date, this.timeFromString, this.getTillDate());
		}
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryWindow();
		this.updateFetchQueryTimeRange();
		await this.fetchData();
	}

	async tillTagChanged(value, oldValue) {
		// console.log(value, oldValue, this.timeTillString);
		if((value == 'date' || value == 'date-time') && (oldValue != 'date' && oldValue != 'date-time' && oldValue != 'date-time-')) {
			let date = oldValue == 'now' ? moment(new Date()) : relativeDate(oldValue);
			// this.timeTillString = date.toISOString().replace('T', ' ');
			this.timeTillString = date.format('YYYY-MM-DD HH:mm:ss');
			console.log('TILL:', oldValue, date, this.timeTillString);
		}
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryWindow();
		this.updateFetchQueryTimeRange();
		await this.fetchData();
	}

	async clusterIDChanged(value, oldValue) {
		this.page = 1;
		this.updateFetchQueryClusterID();
		await this.fetchData();
	}

	// filterSettingsChanged() {
	async filtersChanged() {
		console.log('FILTERS CHANGED:', this.filters)
		this.page = 1;
		this.page2 = 1;
		this.updateFetchQueryWindow();
		this.updateFetchQueryFilters();
		await this.fetchData();
	}

	fullTextSearchKeyDown(key) {
		if(key === 13) {
			this.updateFetchQueryFTS();
			this.fetchData();
		}
		return true;
	}

	async topClustersChanged(value) {
		this.updateFetchQueryClusterCount();
		await this.fetchData();
	}

	removeClusterSelection() {
		this.clusterID = undefined;
	}

	selectCluster(cluster) {
		// this.mapClearMarker();		// geolocation is not compatible with clustering (too slow for now)
		this.clusterID = cluster;
		this.active = 1;
	}

	async initMap(map) {
		this.map = map;
		this.map.addListener('zoom_changed', () => {
			this.mapZoom = this.map.zoom;
			this.mapZoomChanged();
		})
		await this.fetchData();
	}

	async mapItemTypeChanged() {
		await this.fetchData();
	}

	async heatMapRadiusChanged() {
		this.heatMap.set('radius', this.heatMapRadius);
	}

	async clickMap(event) {
		var latLng = event.detail.latLng,
			lat = latLng.lat(),
			lng = latLng.lng();
		this.mapPlaceMarker(latLng);
	}

	mapUpdateMarkerRadius(radius) {
		if(!radius && this.mapPositionRelativeRadius && this.mapPositionRelativeRadius > 0) {
			this.mapPositionRadius = radius = zoomRatios[this.map.zoom]*0.0002*this.mapPositionRelativeRadius;
		}
		if(!this.mapCurrentPositionRadius) {
			this.mapCurrentPositionRadius = new google.maps.Circle({
				strokeColor: '#FF0000',
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: '#FF0000',
				fillOpacity: 0.35,
				geodesic: true,
				map: this.map,
				center: this.currentPosition,
				radius: radius, //Math.sqrt(citymap[city].population) * 100
				draggable: true,
			});
			this.mapCurrentPositionRadius.addListener('drag', (event) => {
				this.mapCurrentPosition.setPosition(this.mapCurrentPositionRadius.center);
			});
			this.mapCurrentPositionRadius.addListener('dragend', (event) => {
				this.mapCurrentPosition.setPosition(this.mapCurrentPositionRadius.center);
				this.currentPosition = this.mapCurrentPositionRadius.center;
			});
		} else {
			this.mapCurrentPositionRadius.setCenter(this.currentPosition);
			this.mapCurrentPositionRadius.setRadius(radius);
		}
	}

	mapPlaceMarker(latLng, radius) {
		if(!this.mapCurrentPosition) {
			this.mapCurrentPosition = new google.maps.Marker({position: latLng, map: this.map, draggable: true});
			this.mapCurrentPosition.addListener('drag', (event) => {
				this.mapCurrentPositionRadius.setCenter(event.latLng);
			});
			this.mapCurrentPosition.addListener('dragend', (event) => {
				this.mapCurrentPositionRadius.setCenter(event.latLng);
				this.currentPosition = event.latLng;
			});
		} else {
			this.mapCurrentPosition.setPosition(latLng);
		}
		this.currentPosition = latLng;
		if(this.mapPositionUseRelativeRadius) {
			if(!radius && this.mapPositionRelativeRadius && this.mapPositionRelativeRadius > 0) {
				radius = zoomRatios[this.map.zoom]*0.0002*this.mapPositionRelativeRadius;
			}
		} else if(!this.mapPositionRadius) {
			radius = zoomRatios[this.map.zoom]*0.0002*10;
		} else {
			radius = this.mapPositionRadius;
		}
		// console.log(this.map.zoom, zoomRatios[this.map.zoom], radius)
		this.mapPositionRadius = radius;
		this.mapUpdateMarkerRadius(radius);
		// this.mapUpdateMarkerRadius(radius);
	}

	mapClearMarker() {
		if(this.mapCurrentPosition) {
			google.maps.event.clearListeners(this.mapCurrentPosition, 'drag');
			google.maps.event.clearListeners(this.mapCurrentPosition, 'dragend');
			this.mapCurrentPosition.setMap(null);
			this.mapCurrentPosition = undefined;
		}
		if(this.mapCurrentPositionRadius) {
			google.maps.event.clearListeners(this.mapCurrentPositionRadius, 'drag');
			google.maps.event.clearListeners(this.mapCurrentPositionRadius, 'dragend');
			this.mapCurrentPositionRadius.setMap(null);
			this.mapCurrentPositionRadius = undefined;
		}
		this.currentPosition = undefined;
		this.mapPositionLatLngText = '';
	}

	async currentPositionChanged() {
		// this.removeClusterSelection();
		if(this.currentPosition) {
			this.mapPositionLatLngText = this.currentPosition.lat().toFixed(7) + ', ' + this.currentPosition.lng().toFixed(7);
		} else {
			this.mapPositionLatLngText = '';
		}
		this.updateNavigation();
		await this.fetchMediaItemsAtLocation();
	}

	async mapPositionRadiusChanged(value) {
		if(!this.mapPositionRadius) {
			this.mapPositionRadius = 0;
			this.mapPositionRelativeRadius = 10;
		}
		if(this.map) {
			this.mapPositionRelativeRadius = this.mapPositionRadius / (zoomRatios[this.map.zoom]*0.0002);
		}

		this.mapUpdateMarkerRadius(this.mapPositionRadius);
		this.mapPositionRadiusText = this.mapPositionRadius.toFixed(3);
		// this.updateNavigation();
		// await this.fetchMediaItemsAtLocation();
	}

	async updateItemsAtLocation() {
		this.updateNavigation();
		await this.fetchMediaItemsAtLocation();
	}

	mapPositionRelativeRadiusChanged(value) {
		value = parseFloat(value);
		if(this.mapPositionUseRelativeRadius && value) {
			this.mapUpdateMarkerRadius();
		}
	}

	mapPositionTextKeyDown(key) {
		if(key === 13) {
			if(this.mapPositionLatLngText && this.mapPositionLatLngText.length > 0) {
				let matches = this.mapPositionLatLngText.match(latLngParseRE);
				if(matches.length == 2) {
					this.currentPosition = new google.maps.LatLng(matches[0], matches[1]);
					this.mapPlaceMarker(this.currentPosition);
				} else {
					this.currentPosition = undefined;
					this.mapClearMarker();
				}
			} else {
				this.currentPosition = undefined;
				this.mapClearMarker();
			}
		}
		return true;
	}

	mapPositionRadiusTextKeyDown(key) {
		if(key === 13) {
			if(this.mapPositionRadiusText && this.mapPositionRadiusText.length > 0) {
				this.mapPositionRadius = parseFloat(this.mapPositionRadiusText);
			} else {
				this.mapPositionRelativeRadius = 0;
			}
		}
		return true;
	}

	mapPositionRelativeRadiusTextKeyDown(key) {
		if(key === 13) {
			if(this.mapPositionRelativeRadiusText && this.mapPositionRelativeRadiusText.length > 0) {
				this.mapPositionRelativeRadius = parseFloat(this.mapPositionRelativeRadiusText);
			} else {
				this.mapPositionRelativeRadius = 0;
			}
		}
		return true;
	}

	mapZoomChanged() {
		this.updateNavigation();
	}
}
