/* Shared public/admin schema. Content is text, never executable HTML. */
(function (root) {
  "use strict";
  const blocks = [
    {
      id: "mobileWelcome",
      name: "Portada móvil",
      selector: ".vl-mobile-intro",
      fields: [
        [
          "title",
          "Título",
          ".vl-mobile-intro h1",
          "Loja te espera.",
          "Loja awaits.",
        ],
        [
          "description",
          "Descripción",
          ".vl-mobile-intro p",
          "Sabores, cultura y nuevas historias por descubrir.",
          "Flavours, culture and new stories to discover.",
        ],
      ],
    },
    {
      id: "explore",
      name: "Tu próxima experiencia",
      selector: ".vl43-explore-feature",
      image: ".vl43-explore-image img",
      imageUrl: "assets/photos/loja-puerta.webp",
      imageAlt: "Puerta de la Ciudad de Loja, Ecuador",
      fields: [
        [
          "eyebrow",
          "Antetítulo",
          ".vl43-eyebrow",
          "TU PRÓXIMA EXPERIENCIA",
          "YOUR NEXT EXPERIENCE",
        ],
        [
          "title",
          "Título",
          ".vl43-explore-content h3",
          "Hay mucho más por descubrir.",
          "There is so much more to discover.",
        ],
        [
          "description",
          "Descripción",
          ".vl43-explore-content p",
          "Desde un café especial hasta una escapada por la provincia. Elige cómo quieres explorar y encuentra tu siguiente parada.",
          "From a special coffee to a getaway around the province. Choose how to explore and find your next stop.",
        ],
        [
          "imageLabel",
          "Etiqueta de la foto",
          ".vl43-photo-label",
          "PUERTA DE LA CIUDAD · LOJA",
          "CITY GATE · LOJA",
        ],
        [
          "button",
          "Primer botón",
          ".vl43-feature-actions a:first-child",
          "Buscar lugares",
          "Find places",
        ],
        [
          "button2",
          "Segundo botón",
          ".vl43-feature-actions a:nth-child(2)",
          "Abrir mapa",
          "Open map",
        ],
      ],
      links: [
        [
          "buttonUrl",
          "Destino del primer botón",
          ".vl43-feature-actions a:first-child",
          "#establecimientos",
        ],
        [
          "button2Url",
          "Destino del segundo botón",
          ".vl43-feature-actions a:nth-child(2)",
          "#mapa",
        ],
      ],
    },
    {
      id: "entrepreneurs",
      name: "Hecho en Loja",
      selector: ".vl44-entrepreneur-header",
      image: ".vl44-entrepreneur-photo img",
      imageUrl: "assets/photos/loja-centro.webp",
      imageAlt: "Calle peatonal 10 de Agosto, en el centro de Loja",
      fields: [
        [
          "eyebrow",
          "Antetítulo",
          ".vl44-eyebrow",
          "Nuevos Talentos",
          "New talent",
        ],
        [
          "title",
          "Título",
          ".vl44-entrepreneur-copy h2",
          "Hecho en Loja, con mucho talento.",
          "Made in Loja, with plenty of talent.",
        ],
        [
          "description",
          "Descripción",
          ".vl44-entrepreneur-copy p",
          "Conoce los emprendimientos que están creando nuevos sabores, productos y experiencias en nuestra provincia.",
          "Meet the ventures creating new flavours, products and experiences in our province.",
        ],
        [
          "imageLabel",
          "Etiqueta de la foto",
          ".vl44-entrepreneur-photo span",
          "APOYA LO LOCAL",
          "SUPPORT LOCAL",
        ],
        [
          "button",
          "Botón",
          ".vl44-entrepreneur-link",
          "Descubrir emprendimientos",
          "Discover local ventures",
        ],
      ],
      links: [
        [
          "buttonUrl",
          "Destino del botón",
          ".vl44-entrepreneur-link",
          "#emprendedoresGridContainer",
        ],
      ],
    },
    {
      id: "cooking",
      name: "Secretos de Cocina con ILE",
      selector: ".vl52-spice-feature",
      image: ".vl52-spice-photo img",
      imageUrl: "assets/photos/repe-lojano.webp",
      imageAlt: "Repe lojano con quesillo y cilantro",
      fields: [
        [
          "title",
          "Título",
          ".vl52-spice-copy h2",
          "Secretos de Cocina con ILE",
          "Cooking secrets with ILE",
        ],
        [
          "description",
          "Descripción",
          ".vl52-spice-copy p",
          "El alma de la gastronomía lojana reside en sus adobos, hierbas aromáticas y el toque inconfundible de Industria Lojana de Especerías, avalado por la Mesa Turística.",
          "The soul of Loja cuisine lies in its seasonings, aromatic herbs and the distinctive touch of Industria Lojana de Especerías, supported by the Tourism Board.",
        ],
        [
          "imageLabel",
          "Etiqueta de la foto",
          ".vl52-spice-photo span",
          "REPE LOJANO",
          "LOJA REPE",
        ],
      ],
    },
  ];
  blocks.push(
    ...[
      {
        id: "categoryIntro",
        name: "Categorías: presentación",
        selector: "#categorias",
        adminModule: "places",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            "#categorias h2",
            "Explora Loja por categoría",
            "Explore Loja by category",
          ],
          [
            "description",
            "Descripción",
            "#categorias h2 + p",
            "Elige una categoría para ver su lista de lugares y experiencias.",
            "Choose a category to see places and experiences.",
          ],
          [
            "gridTitle",
            "Título de categorías",
            ".vl43-categories-heading strong",
            "Explora a tu manera",
            "Explore your way",
          ],
          [
            "gridDescription",
            "Ayuda de categorías",
            ".vl43-categories-heading span",
            "Selecciona una categoría para comenzar",
            "Select a category to start",
          ],
        ],
      },
      {
        id: "placesIntro",
        name: "Paradas: presentación",
        selector: "#establecimientos",
        adminModule: "places",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="secAlliesTitle"]',
            "Paradas de Visita Loja",
            "Visita Loja Stops",
          ],
          [
            "eyebrow",
            "Antetítulo",
            '[data-i18n="secTourism"]',
            "Sabores, hospedaje y experiencias",
            "Flavors, lodging and experiences",
          ],
        ],
      },
      {
        id: "mapIntro",
        name: "Mapa: presentación",
        selector: "#mapa",
        adminModule: "places",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="mapTitle"]',
            "Mapa Interactivo de Loja",
            "Interactive Map of Loja",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="mapDesc"]',
            "Desliza libremente por el mapa o pulsa los pines para explorar los sitios.",
            "Drag freely with one finger on the map or tap the pins to explore spots.",
          ],
        ],
      },
      {
        id: "agendaIntro",
        name: "Agenda: presentación",
        selector: ".vl-agenda-header",
        adminModule: "events",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="agendaTitle"]',
            "Agenda Cultural y Eventos",
            "Cultural Agenda & Events",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="agendaDesc"]',
            "Ferias, festivales y presentaciones artísticas respaldadas por la Mesa Turística. Haz clic en un evento para ubicarlo en el mapa.",
            "Fairs, festivals and artistic presentations backed by the Tourism Board. Click an event to locate it on the map.",
          ],
        ],
      },
      {
        id: "postcardsIntro",
        name: "Postales: presentación",
        selector: "#postales",
        adminModule: "postcards",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="postcardTitle"]',
            "Crea tu Postal  Visita Loja",
            "Create your  Visita Loja  Postcard",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="postcardDesc"]',
            "Sube tu foto, escoge tu marco favorito (FIAVL 2026, Ruta del Café o Tradición Lojana), personaliza tu recuerdo y descárgalo con formato listo para tus Historias de Instagram y WhatsApp.",
            "Upload your photo, pick a signature frame (FIAVL 2026, Coffee Route or Loja Heritage), customize your memory, and export it ready for your Instagram & WhatsApp Stories.",
          ],
        ],
      },
      {
        id: "timeIntro",
        name: "Loja en el Tiempo: presentación",
        selector: "#loja-tiempo",
        adminModule: "time",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="timeTitle"]',
            "Loja en el  Tiempo",
            "Loja Through  Time",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="timeDesc"]',
            "Desliza el cursor o tu dedo sobre las imágenes para viajar entre el ayer y el hoy de nuestros rincones más queridos.",
            "Slide your cursor or finger across the images to travel between yesterday and today in our most iconic spots.",
          ],
        ],
      },
      {
        id: "podcastIntro",
        name: "Podcast: presentación",
        selector: "#podcast",
        adminModule: "podcast",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="podTitle"]',
            "El Podcast de Loja",
            "The Loja Podcast",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="podDesc"]',
            "Conoce a fondo las historias de sacrificio, recetas secretas y la herencia cultural que hay detrás de cada hueca, hotel y cafetería de nuestra provincia.",
            "Get to know the stories of sacrifice, secret recipes and cultural heritage behind each eatery, hotel and coffee shop in our province.",
          ],
        ],
      },
      {
        id: "ileCard1",
        name: "ILE: El Adobo Lojano",
        selector: "#especias .vl52-spice-card:nth-child(1)",
        adminModule: "settings",
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="ileCard1Title"]',
            "El Adobo Lojano",
            "Loja Marinade",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="ileCard1Desc"]',
            "Mezcla magistral de comino, achiote y ajo que impregna la cecina antes de ser asada al carbón de leña.",
            "Masterful blend of cumin, achiote and garlic that infuses cecina before being grilled over firewood coals.",
          ],
          [
            "tag",
            "Etiqueta",
            '[data-i18n="ileCard1Tag"]',
            "Ideal para: Cecina y Secos",
            "Ideal for: Cecina & Stews",
          ],
        ],
      },
      {
        id: "ileCard2",
        name: "ILE: Aromas de Altura",
        selector: "#especias .vl52-spice-card:nth-child(2)",
        adminModule: "settings",
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="ileCard2Title"]',
            "Aromas de Altura",
            "Highland Aromas",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="ileCard2Desc"]',
            "El café de Catamayo y Olmedo marida a la perfección con notas sutiles de canela y clavo de olor en repostería.",
            "Coffee from Catamayo and Olmedo pairs perfectly with subtle notes of cinnamon and cloves in pastry.",
          ],
          [
            "tag",
            "Etiqueta",
            '[data-i18n="ileCard2Tag"]',
            "Ideal para: Cafés y Pasteles",
            "Ideal for: Coffees & Pastries",
          ],
        ],
      },
      {
        id: "ileCard3",
        name: "ILE: El Toque del Repe",
        selector: "#especias .vl52-spice-card:nth-child(3)",
        adminModule: "settings",
        preserveDefault: true,
        fields: [
          [
            "title",
            "Título",
            '[data-i18n="ileCard3Title"]',
            "El Toque del Repe",
            "The Repe Touch",
          ],
          [
            "description",
            "Descripción",
            '[data-i18n="ileCard3Desc"]',
            "El cilantro fresco y un toque de pimienta blanca realzan la cremosidad del banano verde y el quesillo tradicional.",
            "Fresh cilantro and a touch of white pepper enhance the creaminess of green plantain and traditional quesillo.",
          ],
          [
            "tag",
            "Etiqueta",
            '[data-i18n="ileCard3Tag"]',
            "Ideal para: Repe y Sopas",
            "Ideal for: Repe & Soups",
          ],
        ],
      },
    ],
  );
  blocks.push(
    ...[
      {
        id: "festivalIntro",
        name: "Presentación del festival FIAVL",
        adminModule: "events",
        selector: "#fiavl",
        preserveDefault: true,
        noVisibility: true,
        fields: [
          [
            "fiavlBadge",
            "Distintivo",
            '#fiavl [data-i18n="fiavlBadge"]',
            "Loja, Capital Cultural del Ecuador",
            "Loja, Cultural Capital of Ecuador",
          ],
          [
            "fiavlTitle",
            "Título",
            '#fiavl [data-i18n="fiavlTitle"]',
            "FIAVL 2026",
            "FIAVL 2026",
          ],
          [
            "fiavlSubTitle",
            "Subtítulo",
            '#fiavl [data-i18n="fiavlSubTitle"]',
            "Festival Internacional de Artes Vivas de Loja",
            "Loja International Festival of Performing Arts",
          ],
          [
            "fiavlDesc",
            "Descripción",
            '#fiavl [data-i18n="fiavlDesc"]',
            "Loja se transforma en el escenario cultural más grande del país. Obras de teatro, danza contemporánea, circo, artes plásticas e intervenciones escénicas de compañías nacionales e internacionales se toman teatros, plazas y calles emblemáticas de nuestra ciudad.",
            "Loja becomes the country's largest cultural stage. Theater, contemporary dance, circus, visual arts, and performance art from national and international companies take over theaters, squares, and historic streets.",
          ],
          [
            "btnFiavlAgenda",
            "Botón de agenda",
            '#fiavl [data-i18n="btnFiavlAgenda"]',
            "Ver Agenda y Teatros",
            "View Agenda & Theaters",
          ],
          [
            "btnFiavlHotels",
            "Botón de hoteles y cafés",
            '#fiavl [data-i18n="btnFiavlHotels"]',
            "Hoteles y Cafés Cercanos",
            "Nearby Hotels & Cafes",
          ],
        ],
      },
      {
        id: "festivalCard1",
        name: "FIAVL · Tarjeta 1",
        adminModule: "events",
        selector: '#fiavl [data-i18n="fiavlCard1Title"]',
        preserveDefault: true,
        noVisibility: true,
        fields: [
          [
            "fiavlCard1Title",
            "Título",
            '#fiavl [data-i18n="fiavlCard1Title"]',
            "Teatro en Salas",
            "Theater Performances",
          ],
          [
            "fiavlCard1Tag",
            "Etiqueta",
            '#fiavl [data-i18n="fiavlCard1Tag"]',
            "Salas Oficiales",
            "Official Venues",
          ],
          [
            "fiavlCard1Desc",
            "Descripción",
            '#fiavl [data-i18n="fiavlCard1Desc"]',
            "Obras estelares en el Teatro Benjamín Carrión Mora, Teatro Bolívar y Centro Cultural Alfredo Mora Reyes.",
            "Mainstage plays at Benjamín Carrión Mora Theater, Bolívar Theater, and Alfredo Mora Reyes Cultural Center.",
          ],
        ],
      },
      {
        id: "festivalCard2",
        name: "FIAVL · Tarjeta 2",
        adminModule: "events",
        selector: '#fiavl [data-i18n="fiavlCard2Title"]',
        preserveDefault: true,
        noVisibility: true,
        fields: [
          [
            "fiavlCard2Title",
            "Título",
            '#fiavl [data-i18n="fiavlCard2Title"]',
            "Arte en la Calle",
            "Street Art & Acts",
          ],
          [
            "fiavlCard2Tag",
            "Etiqueta",
            '#fiavl [data-i18n="fiavlCard2Tag"]',
            "Espacios Abiertos",
            "Open Spaces",
          ],
          [
            "fiavlCard2Desc",
            "Descripción",
            '#fiavl [data-i18n="fiavlCard2Desc"]',
            "Intervenciones vivas, circo, comparsas y arte visual en la Calle Bolívar, Plaza de San Sebastián y Plaza Central.",
            "Live performances, circus, parades, and street art along Bolívar Street, San Sebastián Square, and Central Square.",
          ],
        ],
      },
      {
        id: "festivalCard3",
        name: "FIAVL · Tarjeta 3",
        adminModule: "events",
        selector: '#fiavl [data-i18n="fiavlCard3Title"]',
        preserveDefault: true,
        noVisibility: true,
        fields: [
          [
            "fiavlCard3Title",
            "Título",
            '#fiavl [data-i18n="fiavlCard3Title"]',
            "Ruta Escénica & Café",
            "Scenic Route & Coffee",
          ],
          [
            "fiavlCard3Tag",
            "Etiqueta",
            '#fiavl [data-i18n="fiavlCard3Tag"]',
            "Gastronomía Nocturna",
            "Night Dining",
          ],
          [
            "fiavlCard3Desc",
            "Descripción",
            '#fiavl [data-i18n="fiavlCard3Desc"]',
            "Cafeterías de especialidad y huecas tradicionales listas para acoger turistas tras cada función estelar.",
            "Specialty coffee shops and local eateries ready to welcome visitors after every premier show.",
          ],
        ],
      },
      {
        id: "festivalCard4",
        name: "FIAVL · Tarjeta 4",
        adminModule: "events",
        selector: '#fiavl [data-i18n="fiavlCard4Title"]',
        preserveDefault: true,
        noVisibility: true,
        fields: [
          [
            "fiavlCard4Title",
            "Título",
            '#fiavl [data-i18n="fiavlCard4Title"]',
            "Sello FIAVL Especial",
            "Special FIAVL Stamp",
          ],
          [
            "fiavlCard4Tag",
            "Etiqueta",
            '#fiavl [data-i18n="fiavlCard4Tag"]',
            "En tu Pasaporte",
            "In your Passport",
          ],
          [
            "fiavlCard4Desc",
            "Descripción",
            '#fiavl [data-i18n="fiavlCard4Desc"]',
            "Visita los puntos artísticos autorizados y obtén validaciones exclusivas en tu pasaporte interactivo.",
            "Visit authorized festival spots and receive exclusive stamps on your smart passport.",
          ],
        ],
      },
    ],
  );
  blocks.push(
    ...[
      {
        id: "passportIntro",
        name: "Presentación del pasaporte",
        adminModule: "passport",
        selector: "#pasaporte",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "passportKicker",
            "Antetítulo",
            '#pasaporte [data-i18n="passportKicker"]',
            "UN RECUERDO QUE SE CONSTRUYE VISITANDO",
            "A MEMORY BUILT ONE VISIT AT A TIME",
          ],
          [
            "passportHeadline",
            "Título",
            '#pasaporte [data-i18n="passportHeadline"]',
            "Tu pasaporte.  Tu historia en Loja.",
            "Your passport.  Your story in Loja.",
          ],
          [
            "passDesc",
            "Descripción",
            '#pasaporte [data-i18n="passDesc"]',
            "Visita negocios y atractivos, escanea su QR y colecciona sellos.",
            "Visit participating businesses, scan their QR and collect stamps.",
          ],
          [
            "passBtnOpen",
            "Botón para abrir",
            '#pasaporte [data-i18n="passBtnOpen"]',
            "Abrir mi Pasaporte",
            "Open my Passport",
          ],
          [
            "passportFindPlaces",
            "Enlace a paradas",
            '#pasaporte [data-i18n="passportFindPlaces"]',
            "Encontrar paradas",
            "Find places",
          ],
          [
            "passportArtNote",
            "Nota junto al pasaporte",
            '#pasaporte [data-i18n="passportArtNote"]',
            "Tus visitas merecen un recuerdo.",
            "Your visits deserve a keepsake.",
          ],
        ],
      },
      {
        id: "passportStep1",
        name: "Pasaporte · Paso 1",
        adminModule: "passport",
        selector: "#pasaporte .vl-passport-steps li:nth-child(1)",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "passportStepExplore",
            "Título",
            '#pasaporte [data-i18n="passportStepExplore"]',
            "Elige tu próxima parada",
            "Choose your next stop",
          ],
          [
            "passportStepExploreHelp",
            "Explicación",
            '#pasaporte [data-i18n="passportStepExploreHelp"]',
            "Encuentra un establecimiento participante y disfruta tu visita.",
            "Find a participating place and enjoy your visit.",
          ],
        ],
      },
      {
        id: "passportStep2",
        name: "Pasaporte · Paso 2",
        adminModule: "passport",
        selector: "#pasaporte .vl-passport-steps li:nth-child(2)",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "passportStepVisit",
            "Título",
            '#pasaporte [data-i18n="passportStepVisit"]',
            "Escanea y confirma",
            "Scan and confirm",
          ],
          [
            "passportStepVisitHelp",
            "Explicación",
            '#pasaporte [data-i18n="passportStepVisitHelp"]',
            "Escanea el QR, genera tu código temporal y pide al personal autorizado que confirme tu visita.",
            "Scan the QR, generate your temporary code and ask authorized staff to confirm your visit.",
          ],
        ],
      },
      {
        id: "passportStep3",
        name: "Pasaporte · Paso 3",
        adminModule: "passport",
        selector: "#pasaporte .vl-passport-steps li:nth-child(3)",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "passportStepCollect",
            "Título",
            '#pasaporte [data-i18n="passportStepCollect"]',
            "Colecciona tus sellos",
            "Collect your stamps",
          ],
          [
            "passportStepCollectHelp",
            "Explicación",
            '#pasaporte [data-i18n="passportStepCollectHelp"]',
            "Consulta el progreso de tu recorrido en el pasaporte.",
            "Check your journey progress in your passport.",
          ],
        ],
      },
      {
        id: "adventureIntro",
        name: "Presentación de las misiones",
        adminModule: "chabaquitoMissions",
        selector: "#chabaquitoV2Public",
        noVisibility: true,
        preserveDefault: true,
        fields: [
          [
            "eyebrow",
            "Antetítulo",
            ".vl-adventure-kicker",
            "CONOCE LOJA. SUPERA EL RETO.",
            "DISCOVER LOJA. TAKE THE CHALLENGE.",
          ],
          [
            "title",
            "Título",
            ".vl-adventure-copy h2",
            "La aventura empieza con Chabaquito.",
            "Adventure begins with Chabaquito.",
          ],
          [
            "description",
            "Descripción",
            ".vl-adventure-copy p",
            "Completa misiones reales, descubre lugares y gana XP e insignias.",
            "Complete real missions, discover places and earn XP and badges.",
          ],
          [
            "button",
            "Botón para elegir misión",
            ".vl-adventure-start",
            "Elegir una misión",
            "Choose a mission",
          ],
          [
            "characterNote",
            "Nota de Chabaquito",
            ".vl-adventure-character span",
            "Tu compañero de aventuras",
            "Your adventure companion",
          ],
          [
            "journeyLabel",
            "Antetítulo del progreso",
            ".vl-adventure-profile-heading span",
            "TU CAMINO",
            "YOUR JOURNEY",
          ],
          [
            "journeyTitle",
            "Título del progreso",
            ".vl-adventure-profile-heading h3",
            "Cada visita cuenta.",
            "Every visit counts.",
          ],
          [
            "missionsLabel",
            "Antetítulo de misiones",
            ".vl-adventure-missions-heading span",
            "EXPLORA A TU RITMO",
            "EXPLORE AT YOUR OWN PACE",
          ],
          [
            "missionsTitle",
            "Título de la lista",
            ".vl-adventure-missions-heading h3",
            "Misiones para vivir Loja",
            "Missions to experience Loja",
          ],
        ],
      },
    ],
  );
  blocks.push(
    ...[
      {
        id: "welcomePlaces",
        name: "Acceso rápido · Comer y alojarse",
        selector: '.vl-discovery-nav a[href="#establecimientos"]',
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "welcomePlaces",
            "Título",
            '[data-i18n="welcomePlaces"]',
            "Comer y alojarse",
            "Eat and stay",
          ],
          [
            "welcomePlacesHelp",
            "Descripción breve",
            '[data-i18n="welcomePlacesHelp"]',
            "Encuentra tu próxima parada",
            "Find your next stop",
          ],
        ],
      },
      {
        id: "welcomePassport",
        name: "Acceso rápido · Tu pasaporte",
        selector: '.vl-discovery-nav a[href="#pasaporte"]',
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "welcomePassport",
            "Título",
            '[data-i18n="welcomePassport"]',
            "Tu pasaporte",
            "Your passport",
          ],
          [
            "welcomePassportHelp",
            "Descripción breve",
            '[data-i18n="welcomePassportHelp"]',
            "Colecciona experiencias",
            "Collect experiences",
          ],
        ],
      },
      {
        id: "welcomeMissions",
        name: "Acceso rápido · Con Chabaquito",
        selector: '.vl-discovery-nav a[href="#misiones"]',
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "welcomeMissions",
            "Título",
            '[data-i18n="welcomeMissions"]',
            "Con Chabaquito",
            "With Chabaquito",
          ],
          [
            "welcomeMissionsHelp",
            "Descripción breve",
            '[data-i18n="welcomeMissionsHelp"]',
            "Descubre y cumple misiones",
            "Discover and complete missions",
          ],
        ],
      },
      {
        id: "welcomeAgenda",
        name: "Acceso rápido · Agenda cultural",
        selector: '.vl-discovery-nav a[href="#agenda"]',
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "welcomeAgenda",
            "Título",
            '[data-i18n="welcomeAgenda"]',
            "Agenda cultural",
            "Cultural calendar",
          ],
          [
            "welcomeAgendaHelp",
            "Descripción breve",
            '[data-i18n="welcomeAgendaHelp"]',
            "Planea tu próxima salida",
            "Plan your next outing",
          ],
        ],
      },
      {
        id: "welcomePhoto",
        name: "Mensaje sobre la fotografía de portada",
        selector: ".vl-welcome-photo-caption",
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "welcomePhotoKicker",
            "Antetítulo",
            '[data-i18n="welcomePhotoKicker"]',
            "TU PRÓXIMA HISTORIA EMPIEZA AQUÍ",
            "YOUR NEXT STORY STARTS HERE",
          ],
          [
            "welcomePhotoTitle",
            "Título",
            '[data-i18n="welcomePhotoTitle"]',
            "Loja, a tu ritmo.",
            "Loja, at your own pace.",
          ],
          [
            "welcomeNow",
            "Botón de recomendaciones",
            '[data-i18n="welcomeNow"]',
            "¿Qué hacer ahora?",
            "What can I do now?",
          ],
        ],
      },
      {
        id: "welcomeActions",
        name: "Presentación y botones de bienvenida",
        selector: ".vl-welcome-actions",
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "inicio",
        fields: [
          [
            "heroBadge",
            "Antetítulo de bienvenida",
            '[data-i18n="heroBadge"]',
            "LOJA SE CONOCE, SE SABOREA Y SE HOSPEDA",
            "Loja is experienced, tasted and hosted",
          ],
          [
            "welcomeMap",
            "Enlace al mapa",
            '[data-i18n="welcomeMap"]',
            "Explorar el mapa",
            "Explore the map",
          ],
          [
            "welcomeRoute",
            "Botón para planificar recorrido",
            '[data-i18n="welcomeRoute"]',
            "Planificar mi recorrido",
            "Plan my route",
          ],
        ],
      },
      {
        id: "footerContact",
        name: "Presentación del contacto",
        selector: ".vl-footer-contact",
        preserveDefault: true,
        noVisibility: true,
        previewAnchor: "contacto",
        fields: [
          [
            "footerContactTitle",
            "Título",
            '[data-i18n="footerContactTitle"]',
            "Hablemos de Loja",
            "Let's talk about Loja",
          ],
          [
            "footerContactHelp",
            "Descripción",
            '[data-i18n="footerContactHelp"]',
            "Consultas, alianzas y asistencia sobre la plataforma.",
            "Questions, partnerships and platform support.",
          ],
        ],
      },
    ],
  );
  for (const id of ["welcomePlaces","welcomePassport","welcomeMissions","welcomeAgenda","welcomePhoto"]) {
    blocks.find(block=>block.id===id).noVisibility=false;
  }
  blocks.find(block=>block.id==="welcomePhoto").fields.push(["location", "Ubicación sobre la foto", ".vl-welcome-location", "LOJA · ECUADOR", "LOJA · ECUADOR"]);
  blocks.push({id:"welcomeSearch",name:"Buscador de portada",selector:".vl-welcome-search",preserveDefault:true,noVisibility:true,previewAnchor:"inicio",fields:[
    ["title","Pregunta del buscador","#welcomeSearchLabel","¿Qué quieres descubrir?","What would you like to discover?"],
    ["button","Botón de búsqueda",".vl-welcome-primary span","Buscar","Search"],
    ["placeholder","Ejemplo de búsqueda","#welcomeSearch","Café, hotel, comida lojana…","Coffee, hotels, local food…","placeholder"]
  ]});
  blocks.find(block=>block.id==="agendaIntro").fields.push(
    ["categoryAgendaTitle","Tarjeta de agenda entre categorías","#exploreCategoryGrid > button:last-child strong","Agenda cultural","Cultural agenda"],
    ["categoryAgendaHelp","Descripción de esa tarjeta","#exploreCategoryGrid > button:last-child > span:last-child","Eventos y actividades","Events and activities"]
  );
  blocks.push({id:"placesCardText",name:"Textos de las tarjetas de lugares",adminModule:"places",selector:"#localesGrid",noVisibility:true,fields:[
    ["title","Antetítulo de las tarjetas","#localesGrid .vl-card-kicker","DESCUBRE LOJA","DISCOVER LOJA"],
    ["button","Invitación a abrir detalles","#localesGrid .vl-card-explore > span:first-child","Ver detalles del lugar","View place details"]
  ]});
  // Presentation only: category IDs, associations and passport eligibility stay unchanged.
  for (const [id,name,nameEn,icon] of [["hotel", "Hoteles y hospedaje", "Hotels & Lodging", "🏨"], ["hueca", "Huecas tradicionales", "Traditional Eateries", "🥘"], ["urbana", "Restaurantes", "Restaurants", "🍽️"], ["cafe", "Cafeterías", "Coffee Shops", "☕"], ["heladeria", "Heladerías", "Ice Cream Shops", "🍦"], ["panaderia", "Panaderías y reposterías", "Bakeries & Pastry Shops", "🥐"], ["bar", "Bares y vida nocturna", "Bars & Nightlife", "🍹"], ["entretenimiento", "Entretenimiento", "Entertainment", "🎳"], ["turismo", "Atractivos turísticos", "Tourist Attractions", "📍"], ["artesania", "Artesanías y comercios locales", "Crafts & Local Shops", "🧵"], ["aliado", "Marcas aliadas", "Partner Brands", "🤝"]]) {
    const selector=`#exploreCategoryGrid [data-category="${id}"]`;
    blocks.push({id:`categoryCard_${id}`,name:`Tarjeta de categoría: ${name}`,adminModule:"places",selector,preserveDefault:true,noVisibility:true,previewAnchor:"categorias",fields:[
      ["title","Nombre en la tarjeta",`${selector} strong`,name,nameEn],
      ["icon","Icono (emoji o texto breve)",`${selector} > span:first-child`,icon,icon]
    ]});
  }
  blocks.find(block=>block.id==="timeIntro").fields.push(
    ["badge","Etiqueta de patrimonio",'[data-i18n="timeBadge"]',"Patrimonio Vivo","Living heritage"],
    ["comparisonHelp","Ayuda del comparador","#timeCompareInstruction","Mueve el control para comparar el ayer y el hoy","Move the control to compare yesterday and today"]
  );
  blocks.find(block=>block.id==="podcastIntro").fields.push(
    ["eyebrow","Etiqueta de presentación",".vl45-podcast-head > span","HISTORIAS PARA ESCUCHAR","STORIES TO LISTEN TO"],
    ["headline","Titular de presentación",".vl45-podcast-head > strong","La voz de nuestra tierra.","The voice of our homeland."],
    ["intro","Introducción de presentación",".vl45-podcast-head > p","Un espacio para descubrir las personas, sabores y tradiciones que hacen especial a Loja.","Discover the people, flavors and traditions that make Loja special."],
    ["subtitle","Etiqueta sobre el reproductor",'[data-i18n="podSub"]',"Episodios Completos","Full episodes"],
    ["audioError","Mensaje si falla el audio","#podcastAudioError","No se pudo reproducir el audio. Comprueba tu conexión e inténtalo de nuevo.","The audio could not be played. Check your connection and try again."]
  );
  const contactBlock = blocks.find(block => block.id === "footerContact");
  contactBlock.name = "Contacto y redes sociales";
  contactBlock.optionalHttpsLinks = true;
  contactBlock.links = [
    ["whatsappUrl", "WhatsApp", "#footerWhatsapp", "https://wa.me/593999999999?text=Hola%2C%20vengo%20desde%20la%20web%20Visita%20Loja%20y%20deseo%20m%C3%A1s%20informaci%C3%B3n."],
    ["youtubeUrl", "YouTube", "#footerYoutube", "https://www.youtube.com/@VisitaLoja"],
    ["tiktokUrl", "TikTok", "#footerTiktok", "https://www.tiktok.com/@visitaloja.com"],
    ["instagramUrl", "Instagram", "#footerInstagram", "https://www.instagram.com/visitaloja.oficial/"],
    ["facebookUrl", "Facebook", "#footerFacebook", "https://www.facebook.com/visitalojaoficial/"]
  ];
  blocks.push({
    id: "footerIdentity", name: "Texto del pie de página", selector: "body > footer",
    preserveDefault: true, noVisibility: true, previewAnchor: "contacto",
    fields: [["title", "Texto final", '[data-i18n="footerText"]',
      "Loja se conoce, se saborea y se hospeda. Con el respaldo de la Mesa Turística de Loja. © 2026.",
      "Loja is experienced, tasted and hosted. Endorsed by Loja Municipality & Tourism Board. © 2026."]]
  });
  function safeContactUrl(value) {
    return value === "" || (typeof value === "string" && /^https:\/\//i.test(value) && safeUrl(value));
  }
  const placeholder = "assets/photos/photo-unavailable.svg";
  function safeUrl(value) {
    if (
      typeof value !== "string" ||
      value.length > 2000 ||
      /[\u0000-\u0020<>"']/.test(value)
    )
      return false;
    if (/^https:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        return Boolean(url.hostname) && !url.username && !url.password;
      } catch {
        return false;
      }
    }
    return (
      /^(?:#[a-zA-Z][\w-]*|\/?[a-zA-Z0-9][a-zA-Z0-9_./?=&%#-]*)$/.test(value) &&
      !value.startsWith("//")
    );
  }
  const text = (value, fallback, max = 700) =>
    typeof value === "string" ? value.slice(0, max) : fallback;
  function normalize(input = {}) {
    const result = {
      version: 1,
      contactEmail: text(input?.contactEmail, "contacto@visitaloja.com", 150),
      blocks: {},
    };
    for (const block of blocks) {
      const saved = input?.blocks?.[block.id] || {};
      const data = { enabled: saved.enabled !== false };
      for (const [key, , , es, en] of block.fields) {
        data[key] = text(saved[key], es);
        data[key + "En"] = text(saved[key + "En"], en);
      }
      for (const [key, , , url] of block.links || [])
        data[key] = (block.optionalHttpsLinks ? safeContactUrl(saved[key]) : safeUrl(saved[key])) ? saved[key] : url;
      if (block.image) {
        data.imageUrl =
          saved.imageUrl === ""
            ? placeholder
            : safeUrl(saved.imageUrl)
              ? saved.imageUrl
              : block.imageUrl;
        data.imageAlt = text(saved.imageAlt, block.imageAlt, 300);
        data.imageCredit = text(saved.imageCredit, "", 500);
      }
      result.blocks[block.id] = data;
    }
    return result;
  }
  function setText(element, value) {
    if (!element) return;
    element.dataset.homeManaged = "true";
    const icons = Array.from(element.children)
      .filter((e) => e.tagName === "I")
      .map((e) => e.cloneNode(true));
    element.replaceChildren(
      ...icons,
      document.createTextNode((icons.length ? " " : "") + value),
    );
  }
  let settings = {};
  function apply(data = settings) {
    settings = data || {};
    root.VisitaLojaWelcomeSettings?.apply(settings);
    const content = normalize(settings.homepageContent);
    const lang =
      document.documentElement.lang === "en" ||
      localStorage.getItem("cyc_lang") === "en"
        ? "en"
        : "es";
    for (const block of blocks) {
      const saved = content.blocks[block.id],
        element = document.querySelector(block.selector);
      if (!element) continue;
      if (!block.noVisibility)
        element.toggleAttribute("data-home-content-hidden", !saved.enabled);
      if (
        block.preserveDefault &&
        !settings.homepageContent?.blocks?.[block.id]
      )
        continue;
      for (const [key, , selector, , , attribute] of block.fields) {
        for (const target of document.querySelectorAll(selector)) {
          const value = saved[lang === "en" ? key + "En" : key] || saved[key];
          if (attribute === "placeholder") target.setAttribute("placeholder",value);
          else setText(target,value);
        }
      }
      for (const [key, , selector] of block.links || []) {
        const link = document.querySelector(selector);
        if (!link) continue;
        if (block.optionalHttpsLinks) link.toggleAttribute("data-home-content-hidden", !saved[key]);
        if (saved[key]) link.setAttribute("href", saved[key]);
        else link.removeAttribute("href");
      }
      if (block.image) {
        const image = document.querySelector(block.image);
        if (image) {
          if (image.getAttribute("src") !== saved.imageUrl)
            image.src = saved.imageUrl;
          image.alt = saved.imageAlt;
          image.dataset.homeManaged = "true";
          image.onerror = () => {
            image.onerror = null;
            image.src = placeholder;
          };
        }
        let credit = element.querySelector(".vl-home-image-credit");
        if (saved.imageCredit) {
          if (!credit) {
            credit = document.createElement("p");
            credit.className = "vl-home-image-credit";
            (
              element.querySelector(".vl52-spice-copy > div") ||
              element.querySelector('[class$="-copy"]') ||
              element.querySelector(".vl43-explore-content") ||
              element
            ).append(credit);
          }
          setText(credit, saved.imageCredit);
        } else credit?.remove();
      }
    }
    const discovery = document.querySelector(".vl-discovery-nav");
    if (discovery) discovery.toggleAttribute("data-home-content-hidden", !document.querySelector('.vl-discovery-inner > a:not([data-home-content-hidden])'));
    const email = content.contactEmail;
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      const link = document.querySelector(".vl-footer-contact a");
      if (link) {
        link.href =
          "mailto:" +
          encodeURIComponent(email) +
          "?subject=Contacto%20desde%20Visita%20Loja";
        setText(link.querySelector("span"), email);
      }
    }
    if (settings.title) {
      setText(
        document.getElementById("heroTitle"),
        lang === "en" ? settings.titleEn || settings.title : settings.title,
      );
      setText(
        document.getElementById("heroSubtitle"),
        lang === "en"
          ? settings.subtitleEn || settings.subtitle
          : settings.subtitle || "",
      );
    }
  }
  root.VisitaLojaHomepage = { blocks, normalize, safeUrl, safeContactUrl, apply, placeholder };
  if (typeof document !== "undefined" && document.querySelector("#inicio")) {
    let cached = {};
    try {
      cached = JSON.parse(localStorage.getItem("cyc_settings") || "{}");
    } catch {}
    apply(cached);
    window.addEventListener("languagechange", () => apply());
  }
})(typeof window !== "undefined" ? window : globalThis);
