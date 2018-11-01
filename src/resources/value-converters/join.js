
export class JoinValueConverter {
	toView(array, separator) {
		if(!separator) {
			separator = ',';
		}
		return array.join(separator);
	}
}
