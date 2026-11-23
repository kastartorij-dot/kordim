shader_type spatial;

uniform sampler2D grain : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grain_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool roof_deck = false;
uniform bool floor_wear = false;
uniform bool furniture_wear = false;
uniform bool fresh_cut = false;
uniform bool vertical_grain = false;
uniform bool length_on_z = false;
uniform vec4 tint : source_color = vec4(.83,.68,.51,1.0);
instance uniform float board_shift = 0.0;

varying vec3 wood_point;
varying vec3 wood_face;
varying vec3 world_point;

float hash2(vec2 point) {
	return fract(sin(dot(point,vec2(127.1,311.7))) * 43758.5453);
}

void vertex() {
	wood_point = VERTEX;
	wood_face = NORMAL;
	world_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	float along = length_on_z ? wood_point.z : wood_point.x;
	float across = length_on_z ? wood_point.x : wood_point.z;
	float lane = across/.262 + .023*sin(along*3.18+across*2.3);
	float seed = roof_deck ? hash2(vec2(floor(lane),floor((along+floor(lane)*1.31)/2.8))) : board_shift;
	float transverse_face = length_on_z ? abs(wood_face.z) : abs(wood_face.x);
	float side_face = 1.0-smoothstep(.34,.85,abs(wood_face.y));
	across = mix(across,across*.75+wood_point.y*1.07,side_face);
	along = mix(along,wood_point.y*.97+across*.48,transverse_face);
	if (vertical_grain) {
		along = wood_point.y;
		across = abs(wood_face.x) > abs(wood_face.z) ? wood_point.z : wood_point.x;
	}
	vec2 grain_uv = vec2(across*.92+seed*.71,along*.69+seed*.33);
	vec3 surface = texture(grain,grain_uv).rgb * tint.rgb;
	float edge = 1.0-smoothstep(.008,.027+fwidth(lane),min(fract(lane),1.0-fract(lane)));
	float end_gap = 1.0-smoothstep(.001,.006,abs(fract((along+floor(lane)*1.31)/2.8)-.5));
	float traffic_distance = abs(world_point.x-(1.45+.53*sin(world_point.z*.92)));
	float rubbed = 1.0-smoothstep(.24,.98,traffic_distance);
	float scuff = texture(grain,grain_uv*vec2(2.9,.53)+vec2(.13,.41)).r;
	float threshold = smoothstep(2.38,3.24,world_point.z)*(1.0-smoothstep(.45,1.28,abs(world_point.x-1.43)));
	float wall_soot = 1.0-smoothstep(.48,1.95,length((world_point.xz-vec2(-3.77,.55))*vec2(.97,.77)));
	float wear = roof_deck ? 1.0-.52*edge-.29*end_gap : (floor_wear ? 1.0 + .17*rubbed - .16*threshold - .26*wall_soot : 1.0);
	if (furniture_wear) {
		float used = exp(-pow(across*7.2,2.0)) * smoothstep(.28,.90,abs(wood_face.y));
		float scratch = texture(grain,grain_uv*vec2(3.75,.67)+vec2(.13,.37)).r;
		float scraped = smoothstep(.035,.27,scratch);
		wear += .105*used-.205*(1.0-scraped) - .09*side_face;
		vec2 radial = vec2(wood_point.y, length_on_z ? wood_point.x : wood_point.z);
		float rings = sin(length(radial*vec2(1.31,.94)+vec2(.019,-.021))*177.0+scratch*1.4);
		surface *= mix(vec3(1.0),vec3(.90+(.085*rings)),transverse_face);
		if (fresh_cut) {
			vec3 sapwood = vec3(.48,.30,.16)*(.77+.18*rings+.22*scuff+seed*.13);
			surface = mix(surface,sapwood,transverse_face*.71);
		}
	}
	ALBEDO = surface * (wear + (scuff-.36)*.15 + seed*.145) * mix(vec3(.88),COLOR.rgb,.45);
	NORMAL_MAP = texture(grain_normal,grain_uv).rgb;
	NORMAL_MAP_DEPTH = roof_deck ? .54 : .37;
	ROUGHNESS = roof_deck ? .94 : .87 + (floor_wear ? .08*threshold : 0.0);
	SPECULAR = .17;
}
