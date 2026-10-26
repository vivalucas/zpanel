// Package panelconfig validates known style fields while preserving extension fields.
package panelconfig

import (
	"fmt"
	"math"
	"sort"
	"unicode/utf8"
)

var stringsFields = map[string]int{"logoText": 200, "logoImageSrc": 2048, "backgroundImageSrc": 2048, "iconTextColor": 100, "clockColor": 100, "footerHtml": 65536}
var boolFields = map[string]bool{"wallpaperAutoContrast": true, "iconTextInfoHideDescription": true, "iconTextIconHideTitle": true, "clockShowSecond": true, "searchBoxShow": true, "searchBoxSearchIcon": true, "systemMonitorShow": true, "systemMonitorShowTitle": true, "systemMonitorPublicVisitModeShow": true, "netModeChangeButtonShow": true}
var numberFields = map[string][2]float64{"backgroundBlur": {0, 30}, "backgroundMaskNumber": {0, 1}, "marginTop": {0, 50}, "marginBottom": {0, 50}, "marginX": {0, 100}, "maxWidth": {1, 3000}}

func validField(key string, value interface{}) bool {
	if max, known := stringsFields[key]; known {
		v, ok := value.(string)
		return ok && utf8.RuneCountInString(v) <= max
	}
	if boolFields[key] {
		_, ok := value.(bool)
		return ok
	}
	if bounds, known := numberFields[key]; known {
		v, ok := value.(float64)
		return ok && !math.IsNaN(v) && !math.IsInf(v, 0) && v >= bounds[0] && v <= bounds[1]
	}
	if key == "iconStyle" {
		v, ok := value.(float64)
		return ok && (v == 1 || v == 2)
	}
	if key == "maxWidthUnit" {
		return value == "px" || value == "%"
	}
	return true
}

func Validate(panel map[string]interface{}) error {
	for key, value := range panel {
		if !validField(key, value) {
			return fmt.Errorf("invalid panel field: %s", key)
		}
	}
	return nil
}

// Invalid legacy fields use frontend defaults until the user explicitly saves a repair.
func Sanitize(panel map[string]interface{}) (map[string]interface{}, []string) {
	clean := map[string]interface{}{}
	warnings := []string{}
	for key, value := range panel {
		if validField(key, value) {
			clean[key] = value
		} else {
			warnings = append(warnings, key)
		}
	}
	sort.Strings(warnings)
	return clean, warnings
}
