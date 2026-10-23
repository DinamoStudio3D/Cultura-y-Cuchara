"use strict";
const BASE="https://www.visitaloja.com", PROJECT="cultura-y-cuchara";
const CONFIG={
  "hoteles-en-loja": {
    "title": "Hoteles en la provincia de Loja",
    "description": "Explora alojamientos publicados en distintos cantones de la provincia de Loja y encuentra información para planificar tu estadía.",
    "categories": [
      "hotel",
      "hoteles",
      "hostal",
      "hostales",
      "hospedaje",
      "alojamiento",
      "alojamientos"
    ],
    "intro": "Descubre opciones de hospedaje en la provincia de Loja. Consulta cada ficha para conocer el establecimiento, su ubicación y sus servicios."
  },
  "restaurantes-en-loja": {
    "title": "Restaurantes en la provincia de Loja",
    "description": "Conoce restaurantes de la provincia de Loja con información y enlaces directos a sus fichas en VisitaLoja.com.",
    "categories": [
      "restaurante",
      "restaurantes",
      "restaurant",
      "urbana",
      "comida tipica",
      "gastronomia",
      "picanteria",
      "hueca",
      "asadero",
      "cevicheria"
    ],
    "intro": "Encuentra restaurantes para disfrutar de la gastronomía de Loja y sus cantones. Revisa la información publicada por cada establecimiento."
  },
  "cafeterias-en-loja": {
    "title": "Cafeterías en la provincia de Loja",
    "description": "Descubre cafeterías y espacios para disfrutar del café en la provincia de Loja, Ecuador.",
    "categories": [
      "cafeteria",
      "cafeterias",
      "cafe",
      "coffee shop"
    ],
    "intro": "Explora cafeterías de la provincia de Loja y conoce sus propuestas. Abre las fichas para descubrir más detalles."
  },
  "que-hacer-en-loja": {
    "title": "Qué hacer en Loja, Ecuador: lugares y recorrido de un día",
    "guide": true,
    "description": "Descubre qué hacer en la ciudad de Loja: Puerta de la Ciudad, San Sebastián y Jipiro, con un plan de un día, sabores locales y consejos para organizar tu visita.",
    "categories": [
      "turismo",
      "atractivo turistico",
      "atractivos turisticos",
      "experiencia turistica",
      "experiencias turisticas",
      "lugar turistico",
      "sitio turistico",
      "atractivo",
      "naturaleza",
      "cultura",
      "aventura",
      "destino turistico"
    ],
    "intro": "La provincia de Loja tiene múltiples destinos y experiencias por descubrir. Comienza por estos lugares publicados y consulta sus fichas para planificar tu visita."
  },
  "huecas-en-loja": {
    "title": "Huecas tradicionales en la provincia de Loja",
    "description": "Encuentra huecas y propuestas de comida tradicional publicadas en Loja y sus cantones. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "hueca",
      "huecas",
      "huecas tradicionales",
      "comida tipica",
      "picanteria"
    ],
    "intro": "Encuentra huecas y propuestas de comida tradicional publicadas en Loja y sus cantones.",
    "editorial": {
      "label": "Recorre los sabores locales",
      "short": "Huecas",
      "title": "Huecas tradicionales en Loja",
      "lead": "Tradición que se sirve a la mesa.",
      "note": "Encuentra huecas y propuestas de comida tradicional publicadas en Loja y sus cantones.",
      "tip": "Antes de tu visita",
      "help": "Consulta los platos disponibles, la ubicación y los horarios directamente con cada establecimiento."
    }
  },
  "panaderias-en-loja": {
    "title": "Panaderías y reposterías en la provincia de Loja",
    "description": "Explora panaderías, pastelerías y reposterías de Loja para tu próxima pausa o celebración. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "panaderia",
      "panaderias",
      "pasteleria",
      "pastelerias",
      "reposteria",
      "reposterias",
      "panaderias y reposterias"
    ],
    "intro": "Explora panaderías, pastelerías y reposterías de Loja para tu próxima pausa o celebración.",
    "editorial": {
      "label": "Sabores recién descubiertos",
      "short": "Panaderías",
      "title": "Panaderías y reposterías en Loja",
      "lead": "Pequeños antojos.\nGrandes momentos.",
      "note": "Explora panaderías, pastelerías y reposterías de Loja para tu próxima pausa o celebración.",
      "tip": "Antes de tu visita",
      "help": "Consulta los productos del día, los horarios y los tiempos de preparación de pedidos con el establecimiento."
    }
  },
  "heladerias-en-loja": {
    "title": "Heladerías en la provincia de Loja",
    "description": "Descubre heladerías publicadas en Loja y encuentra un lugar para compartir algo dulce. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "heladeria",
      "heladerias",
      "helados"
    ],
    "intro": "Descubre heladerías publicadas en Loja y encuentra un lugar para compartir algo dulce.",
    "editorial": {
      "label": "Un antojo en el camino",
      "short": "Heladerías",
      "title": "Heladerías en Loja",
      "lead": "Una pausa para disfrutar.",
      "note": "Descubre heladerías publicadas en Loja y encuentra un lugar para compartir algo dulce.",
      "tip": "Antes de tu visita",
      "help": "Confirma los horarios, sabores disponibles e ingredientes directamente con la heladería."
    }
  },
  "bares-en-loja": {
    "title": "Bares y vida nocturna en la provincia de Loja",
    "description": "Explora bares y espacios de vida nocturna publicados en Loja y sus cantones. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "bar",
      "bares",
      "vida nocturna",
      "bares y vida nocturna",
      "cocteleria",
      "pub",
      "discoteca"
    ],
    "intro": "Explora bares y espacios de vida nocturna publicados en Loja y sus cantones.",
    "editorial": {
      "label": "Loja al caer el sol",
      "short": "Bares",
      "title": "Bares y vida nocturna en Loja",
      "lead": "La noche tiene su propio ritmo.",
      "note": "Explora bares y espacios de vida nocturna publicados en Loja y sus cantones.",
      "tip": "Antes de tu visita",
      "help": "Consulta los horarios, condiciones de ingreso y reservas del establecimiento. Planifica tu transporte de regreso."
    }
  },
  "entretenimiento-en-loja": {
    "title": "Entretenimiento en la provincia de Loja",
    "description": "Encuentra espacios de entretenimiento publicados en Loja y organiza tu próximo plan. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "entretenimiento",
      "recreacion",
      "diversion",
      "centro recreativo",
      "parque de diversiones"
    ],
    "intro": "Encuentra espacios de entretenimiento publicados en Loja y organiza tu próximo plan.",
    "editorial": {
      "label": "Planes para compartir",
      "short": "Entretenimiento",
      "title": "Entretenimiento en Loja",
      "lead": "Haz espacio para divertirte.",
      "note": "Encuentra espacios de entretenimiento publicados en Loja y organiza tu próximo plan.",
      "tip": "Antes de tu visita",
      "help": "Revisa las actividades, horarios, tarifas y condiciones de acceso directamente con cada espacio."
    }
  },
  "artesanias-en-loja": {
    "title": "Artesanías y comercios locales en la provincia de Loja",
    "description": "Descubre artesanías y comercios locales publicados en Loja y conoce sus propuestas. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "artesania",
      "artesanias",
      "artesanias y comercios locales",
      "comercio local",
      "comercios locales"
    ],
    "intro": "Descubre artesanías y comercios locales publicados en Loja y conoce sus propuestas.",
    "editorial": {
      "label": "Talento de nuestra tierra",
      "short": "Artesanías",
      "title": "Artesanías y comercios en Loja",
      "lead": "Llévate una historia de Loja.",
      "note": "Descubre artesanías y comercios locales publicados en Loja y conoce sus propuestas.",
      "tip": "Antes de tu visita",
      "help": "Consulta materiales, disponibilidad, precios y opciones de personalización con cada negocio."
    }
  },
  "marcas-aliadas-en-loja": {
    "title": "Marcas aliadas de VisitaLoja en Loja",
    "description": "Conoce las marcas y servicios locales publicados como aliados de VisitaLoja. Consulta sus fichas en VisitaLoja.com.",
    "categories": [
      "aliado",
      "aliados",
      "marca aliada",
      "marcas aliadas"
    ],
    "intro": "Conoce las marcas y servicios locales publicados como aliados de VisitaLoja.",
    "editorial": {
      "label": "Juntos descubrimos Loja",
      "short": "Marcas aliadas",
      "title": "Marcas aliadas de VisitaLoja",
      "lead": "Conectamos el talento local.",
      "note": "Conoce las marcas y servicios locales publicados como aliados de VisitaLoja.",
      "tip": "Conoce a nuestros aliados",
      "help": "Abre cada ficha para conocer la propuesta de la marca, su ubicación y sus canales de contacto."
    }
  }
};
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function val(v){if(!v)return"";if("stringValue"in v)return v.stringValue;if("booleanValue"in v)return v.booleanValue;if("arrayValue"in v)return(v.arrayValue.values||[]).map(val);if("mapValue"in v){const o={};for(const[k,x]of Object.entries(v.mapValue.fields||{}))o[k]=val(x);return o}return""}
function match(x,c){const raw=[x.category,x.categoria,x.type,x.tipo].flatMap(v=>Array.isArray(v)?v:[v]);return raw.some(v=>c.categories.includes(slug(v).replace(/-/g," ")))}
function published(x){const statuses=[x.publicationStatus,x.status].filter(v=>v!==undefined&&v!==null&&String(v).trim()!=="").map(v=>String(v).toLowerCase());return x.active!==false&&(!x.publicationStatus||x.publicationStatus==="published")&&!/motel/i.test([x.category,x.tag,x.title,x.type].join(" "))&&statuses.every(v=>["published","active"].includes(v))}
async function places(fetchImpl=fetch){let token="",all=[];do{const u=new URL("https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)/documents/locales");u.searchParams.set("pageSize","300");if(token)u.searchParams.set("pageToken",token);const r=await fetchImpl(u);if(!r.ok)throw Error("Firestore "+r.status);const data=await r.json();for(const d of data.documents||[]){const x={id:decodeURIComponent(d.name.split("/").pop())};for(const[k,v]of Object.entries(d.fields||{}))x[k]=val(v);if(!published(x))continue;all.push(x)}token=data.nextPageToken||""}while(token);return all}
function render(key,items,availableKeys=[key]){return require("../js/category-seo-view.cjs")(key,items,availableKeys,CONFIG)}
module.exports=async function handler(req,res){if(req.query?.canton!==undefined)return require("../js/canton-seo-server.cjs").createHandler()(req,res);const key=String(req.query.categoria||"");if(!Object.hasOwn(CONFIG,key))return res.status(404).send("Categoría no encontrada");try{const all=await places(),items=all.filter(x=>match(x,CONFIG[key])).sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"es"));if(!items.length&&!CONFIG[key].guide){res.setHeader("X-Robots-Tag","noindex, follow");res.setHeader("Content-Type","text/html; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=300");return res.status(200).send(render(key,[],Object.keys(CONFIG).filter(k=>all.some(x=>match(x,CONFIG[k])))));}res.setHeader("Content-Type","text/html; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=3600");return res.status(200).send(render(key,items,Object.keys(CONFIG).filter(k=>all.some(x=>match(x,CONFIG[k])))))}catch(e){console.error("SEO category",e);return res.status(503).send("No se pudo cargar la categoría.")}};
module.exports._test={CONFIG,match,render,slug,published};
