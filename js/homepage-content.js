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
        data[key] = safeUrl(saved[key]) ? saved[key] : url;
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
      if (
        block.preserveDefault &&
        !settings.homepageContent?.blocks?.[block.id]
      )
        continue;
      if (!block.noVisibility)
        element.toggleAttribute("data-home-content-hidden", !saved.enabled);
      for (const [key, , selector] of block.fields)
        setText(
          document.querySelector(selector),
          saved[lang === "en" ? key + "En" : key] || saved[key],
        );
      for (const [key, , selector] of block.links || [])
        document.querySelector(selector)?.setAttribute("href", saved[key]);
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
  root.VisitaLojaHomepage = { blocks, normalize, safeUrl, apply, placeholder };
  if (typeof document !== "undefined" && document.querySelector("#inicio")) {
    let cached = {};
    try {
      cached = JSON.parse(localStorage.getItem("cyc_settings") || "{}");
    } catch {}
    apply(cached);
    window.addEventListener("languagechange", () => apply());
  }
})(typeof window !== "undefined" ? window : globalThis);
