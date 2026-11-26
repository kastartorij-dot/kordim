shader_type spatial;
render_mode unshaded;

uniform sampler2D wallpaper : source_color, filter_linear_mipmap;
uniform vec2 screen_min;
uniform vec2 screen_size;
uniform float brightness = 0.68;
varying vec2 screen_uv;

void vertex() {
	screen_uv = (VERTEX.xy - screen_min) / screen_size;
	screen_uv = vec2(1.0) - screen_uv;
}

void fragment() {
	ALBEDO = texture(wallpaper, screen_uv).rgb * brightness;
}
