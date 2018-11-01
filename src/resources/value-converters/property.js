
export class PropertyValueConverter {
	toView(array, property) {
		return array.map(obj => obj[property]);
	}
}
