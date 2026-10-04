/* Линейные иконки 24×24: разделы мира и гербы фракций. */
const P = {
  dot:'<circle cx="12" cy="12" r="3"/>',
  coin:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
  seal:'<path d="M5 3h14v8c-2 1.5-4-1.5-7 0s-5-1.5-7 0z"/><path d="M5 14c2-1.5 4 1.5 7 0s5 1.5 7 0v7H5z"/>',
  road:'<path d="M8 21 11 3M16 21 13 3"/><path d="M12 7v2M12 12v2M12 17v2"/>',
  people:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15.5 14c3 0 5.5 2 5.5 5"/>',
  flask:'<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  blade:'<path d="M4 20 16 8l4-4-1 5L7 21z"/><path d="M6 14l4 4"/>',
  scales:'<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/>',
  hearth:'<path d="M3 21h18M5 21V10l7-6 7 6v11"/><path d="M12 18c-2 0-3-1.5-2-3.5.5 1 1.5 1 1.5-.5 0-1 1-2 1.5-2.5.5 2 2 3 1.5 4.5-.3 1.2-1.2 2-2.5 2z"/>',
  spots:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5"/><circle cx="14" cy="14.5" r="2"/><circle cx="15" cy="8" r="1"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  columns:'<path d="M3 21h18M4 9h16L12 4z"/><path d="M6 9v10M10 9v10M14 9v10M18 9v10"/>',
  bell:'<path d="M12 3v2M7 17v-6a5 5 0 0 1 10 0v6l2 2H5z"/><path d="M10 21h4"/>',
  crown:'<path d="M3 18 4 7l5 4 3-6 3 6 5-4 1 11z"/><path d="M4 21h16"/>',
  crate:'<path d="M3 9h18v11H3z"/><path d="M3 9l3-5h12l3 5M12 9v11M3 14.5h18"/>',
  hammer:'<path d="M4 21l9-9"/><path d="m11 6 5-3 5 5-3 5z"/><path d="M13.5 8.5l2 2"/>',
  pass:'<path d="M2 21 9 8l3 5 3-5 7 13z"/><path d="M10 21v-4h4v4"/>',
  dagger:'<path d="M12 2v11M9 10h6M12 13l-1.5 3h3z"/><path d="M3 20c2-1.5 4 1.5 6 0s4 1.5 6 0 4 1.5 6 0"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  fist:'<path d="M6 11V7a2 2 0 0 1 4 0v3M10 10V6a2 2 0 0 1 4 0v4M14 10V7a2 2 0 0 1 4 0v6c0 4-3 8-7 8s-6-3-6-6v-2a2 2 0 0 1 4 0"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  letter:'<path d="M3 6h18v12H3z"/><path d="m3 6 9 7 9-7"/>',
  sail:'<path d="M12 2v17M12 3l8 13h-8M12 6 5 16h7"/><path d="M3 19h18l-2 3H5z"/>',
  tree:'<path d="M12 22v-8M12 15l-3-2.5M12 13l3.5-3"/><path d="M12 3a7 7 0 0 0-7 7c0 3 2 5 4 5h6c2 0 4-2 4-5a7 7 0 0 0-7-7z"/>',
  tally:'<path d="M5 4v16M10 4v16M15 4v16M20 4v16M3 15l19-7"/>'
};
export const icon = (name, size = 20) =>
  '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.dot) + '</svg>';
