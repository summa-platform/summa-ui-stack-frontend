export function configure(config) {
  config.globalResources([
	  './binding-behaviors/one-way-out',
	  './binding-behaviors/observe-properties',
	  './value-converters/json',
	  './value-converters/keys',
	  './value-converters/join',
	  './value-converters/property',
	  './value-converters/filterObjects',
	  './value-converters/empty',
	  './value-converters/complete',
	  './elements/loading-indicator',
	  './attributes/open-new-tab',
  ]);
  // config.globalResources(['./binding-behaviors/one-way-out', './value-converters/json', './value-converters/iterable']);
}
