shader_type sky;

uniform int lighting_mode = 0;
uniform float winter_amount : hint_range(0.0, 1.0) = 0.0;

float hash(vec2 point) {
	vec3 p = fract(vec3(point.xyx) * 0.1031);
	p += dot(p, p.yzx + 33.33);
	return fract((p.x + p.y) * p.z);
}

float noise_at(vec2 point) {
	vec2 cell = floor(point);
	vec2 blend = fract(point);
	blend = blend * blend * (3.0 - 2.0 * blend);
	return mix(
		mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
		mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
		blend.y
	);
}

float cloud_field(vec2 point) {
	mat2 rotate = mat2(vec2(0.82, 0.57), vec2(-0.57, 0.82));
	float density = noise_at(point) * 0.54;
	point = rotate * point * 2.03 + 12.7;
	density += noise_at(point) * 0.26;
	point = rotate * point * 2.07;
	density += noise_at(point) * 0.13;
	return density + noise_at(point * 2.1) * 0.07;
}

void sky() {
	vec3 direction = normalize(EYEDIR);
	float elevation = max(direction.y, 0.0);
	float height = pow(elevation, 0.55);
	float west = pow(max(dot(direction, normalize(vec3(-0.72, 0.22, 0.65))), 0.0), 3.0);
	float w = clamp(winter_amount, 0.0, 1.0);

	vec3 ground = vec3(0.22, 0.25, 0.27);
	vec3 horizon = vec3(0.62, 0.68, 0.72);
	vec3 zenith = vec3(0.27, 0.37, 0.48);
	vec3 cloud_light = vec3(0.71, 0.75, 0.78);
	vec3 cloud_shadow = vec3(0.34, 0.40, 0.46);

	vec3 w_ground = vec3(0.74, 0.79, 0.85);
	vec3 w_horizon = vec3(0.76, 0.81, 0.87);
	vec3 w_zenith = vec3(0.46, 0.54, 0.64);
	vec3 w_cloud_light = vec3(0.84, 0.87, 0.91);
	vec3 w_cloud_shadow = vec3(0.54, 0.60, 0.68);

	if (lighting_mode == 1) {
		ground = vec3(0.043, 0.052, 0.076);
		horizon = mix(vec3(0.30, 0.34, 0.43), vec3(0.52, 0.33, 0.26), west);
		zenith = vec3(0.09, 0.15, 0.28);
		cloud_light = mix(vec3(0.30, 0.33, 0.40), vec3(0.47, 0.32, 0.32), west);
		cloud_shadow = vec3(0.12, 0.15, 0.23);

		w_ground = vec3(0.19, 0.22, 0.29);
		w_horizon = mix(vec3(0.34, 0.40, 0.52), vec3(0.54, 0.39, 0.42), west);
		w_zenith = vec3(0.11, 0.17, 0.31);
		w_cloud_light = mix(vec3(0.38, 0.43, 0.53), vec3(0.52, 0.39, 0.45), west);
		w_cloud_shadow = vec3(0.16, 0.20, 0.30);
	} else if (lighting_mode == 2) {
		ground = vec3(0.004, 0.006, 0.011);
		horizon = vec3(0.032, 0.044, 0.073);
		zenith = vec3(0.009, 0.016, 0.034);
		cloud_light = vec3(0.044, 0.054, 0.078);
		cloud_shadow = vec3(0.012, 0.018, 0.034);

		w_ground = vec3(0.042, 0.054, 0.078);
		w_horizon = vec3(0.072, 0.092, 0.135);
		w_zenith = vec3(0.020, 0.030, 0.056);
		w_cloud_light = vec3(0.088, 0.105, 0.145);
		w_cloud_shadow = vec3(0.030, 0.040, 0.064);
	}

	ground = mix(ground, w_ground, w);
	horizon = mix(horizon, w_horizon, w);
	zenith = mix(zenith, w_zenith, w);
	cloud_light = mix(cloud_light, w_cloud_light, w);
	cloud_shadow = mix(cloud_shadow, w_cloud_shadow, w);

	vec3 clear_sky = mix(horizon, zenith, height);

	// A plane above the scene compresses distant clouds toward the horizon.
	vec2 plane = direction.xz / (elevation + 0.23);
	plane = plane * vec2(1.95, 2.65) + vec2(16.4, -8.2);
	float density = cloud_field(plane);
	float lighting = cloud_field(plane + vec2(-0.46, 0.30));
	float cover_low = mix(0.31, 0.18, w);
	float cover_high = mix(0.59, 0.48, w);
	float cover = smoothstep(cover_low, cover_high, density) * smoothstep(0.005, 0.17, elevation);
	float silver = clamp(0.5 + (density - lighting) * 2.0, 0.16, 0.94);
	vec3 clouds = mix(cloud_shadow, cloud_light, silver);
	float thin_layer = smoothstep(0.49, 0.72, cloud_field(plane * 0.39 - 4.6));
	clear_sky = mix(clear_sky, cloud_light, thin_layer * mix(0.24, 0.40, w) * smoothstep(0.03, 0.36, elevation));
	vec3 upper_sky = mix(clear_sky, clouds, cover);
	COLOR = mix(ground, upper_sky, smoothstep(-0.25, 0.015, direction.y));
}
