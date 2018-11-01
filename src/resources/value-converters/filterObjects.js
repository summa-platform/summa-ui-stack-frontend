
export class FilterObjectsValueConverter {
	toView(array, config) {
		return array.filter(obj => config.conditions[obj[config.key]]);
	}
}
