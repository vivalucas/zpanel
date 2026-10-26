package panelconfig

import "testing"

func TestStyleBoundariesAndRecoverableLegacyFields(t *testing.T) {
	for _, invalid := range []map[string]interface{}{{"iconTextColor": float64(42)}, {"backgroundBlur": float64(-1)}, {"searchBoxShow": "yes"}, {"maxWidth": nil}, {"iconStyle": float64(3)}} {
		if Validate(invalid) == nil {
			t.Fatal("accepted invalid field", invalid)
		}
	}
	if err := Validate(map[string]interface{}{"searchBoxShow": false, "backgroundBlur": float64(0), "maxWidthUnit": "%", "maxWidth": float64(100)}); err != nil {
		t.Fatal(err)
	}
	clean, warnings := Sanitize(map[string]interface{}{"logoText": "Keep", "iconTextColor": float64(42)})
	if len(warnings) != 1 || clean["logoText"] != "Keep" || clean["iconTextColor"] != nil {
		t.Fatal("incorrect legacy repair")
	}
}

func TestWallpaperContrastChoicesAndLegacyRepair(t *testing.T) {
	for _, value := range []interface{}{false, true} {
		panel := map[string]interface{}{"wallpaperAutoContrast": value, "backgroundMaskNumber": float64(0), "backgroundBlur": float64(0)}
		if err := Validate(panel); err != nil {
			t.Fatal(err)
		}
		clean, warnings := Sanitize(panel)
		if len(warnings) != 0 || clean["wallpaperAutoContrast"] != value || clean["backgroundMaskNumber"] != float64(0) || clean["backgroundBlur"] != float64(0) {
			t.Fatal("wallpaper preference was changed", clean, warnings)
		}
	}
	for _, value := range []interface{}{"false", float64(0), nil, map[string]interface{}{}, []interface{}{}} {
		panel := map[string]interface{}{"wallpaperAutoContrast": value, "backgroundMaskNumber": float64(0)}
		if Validate(panel) == nil {
			t.Fatal("accepted invalid wallpaper contrast choice", value)
		}
		clean, warnings := Sanitize(panel)
		if len(warnings) != 1 || warnings[0] != "wallpaperAutoContrast" || len(clean) != 1 || clean["backgroundMaskNumber"] != float64(0) {
			t.Fatal("incorrect wallpaper legacy repair", clean, warnings)
		}
	}
	clean, warnings := Sanitize(map[string]interface{}{"backgroundMaskNumber": float64(0)})
	if _, exists := clean["wallpaperAutoContrast"]; exists || len(warnings) != 0 {
		t.Fatal("reading a legacy config inserted a preference", clean, warnings)
	}
}
