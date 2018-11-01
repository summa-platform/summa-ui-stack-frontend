
export class EmptyValueConverter {
	toView(array, value) {
		if(array.length == 0) {
			return [value];
		}
		return array;
	}
}
