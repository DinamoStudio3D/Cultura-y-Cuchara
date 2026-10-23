'use strict';
const plans = {
  'cafeterias-en-loja': {
    title: 'Encuentra tu pausa ideal',
    intro: 'Una parada breve, una conversación larga o un café antes de seguir el recorrido: elige según tu plan. Las fichas reúnen las cafeterías publicadas en la ciudad y otros cantones de Loja.',
    steps: [
      ['Empieza por la ubicación', 'Comprueba la dirección para saber si queda cerca de tu recorrido. Si viajas por la provincia, confirma también el cantón antes de desplazarte.'],
      ['Consulta la propuesta', 'Revisa la descripción y las fotos disponibles. Pregunta por los métodos de preparación, las bebidas y los acompañamientos que te interesan.'],
      ['Prepara tu visita', 'Confirma el horario del día. Si necesitas conexión, enchufes, accesibilidad o espacio para un grupo, consulta esas condiciones con la cafetería.']
    ],
    question: '¿Puedo ir a desayunar o trabajar?',
    answer: 'Depende de cada cafetería. Consulta su menú, horario y condiciones de uso del espacio directamente con el negocio; aparecer en esta categoría no garantiza esos servicios.',
    links: [['/restaurantes-en-loja', 'Encuentra dónde comer'], ['/hoteles-en-loja', 'Prepara tu estadía']]
  },
  'restaurantes-en-loja': {
    title: 'Elige dónde comer según tu plan',
    intro: 'Consulta los restaurantes y propuestas gastronómicas publicados en Loja y sus cantones. La mejor opción para tu visita dependerá de la ubicación, el menú y las necesidades de tu grupo.',
    steps: [
      ['Sitúa tu próxima parada', 'Revisa la dirección de la ficha y compárala con tu recorrido. Distingue entre la ciudad de Loja y los demás destinos de la provincia.'],
      ['Mira qué te apetece', 'Lee la propuesta del establecimiento. Consulta el menú vigente y los precios con el restaurante antes de decidir, especialmente si buscas un plato concreto.'],
      ['Pregunta antes de ir', 'Confirma horarios, reservas y atención para grupos. Si tienes alergias o restricciones alimentarias, pregunta por los ingredientes y la preparación directamente al restaurante.']
    ],
    question: '¿Todos los restaurantes sirven comida típica de Loja?',
    answer: 'Las fichas pueden incluir distintas propuestas gastronómicas. Revisa la descripción de cada lugar y confirma los platos disponibles; la categoría no implica que todos ofrezcan el mismo tipo de cocina.',
    links: [['/cafeterias-en-loja', 'Haz una pausa para el café'], ['/hoteles-en-loja', 'Busca tu alojamiento']]
  },
  'hoteles-en-loja': {
    title: 'Prepara una estadía a tu medida',
    intro: 'Explora los alojamientos publicados en la provincia de Loja. Antes de reservar, compara su ubicación con los lugares que quieres visitar y consulta las condiciones para tus fechas.',
    steps: [
      ['Elige tu punto de partida', 'Comprueba en qué ciudad o cantón está el alojamiento. Revisa la dirección y considera cómo llegarás a tus actividades y puntos de interés.'],
      ['Confirma lo que necesitas', 'Pregunta por el tipo de habitación, accesibilidad, estacionamiento, desayuno o admisión de mascotas cuando sean importantes para tu viaje. No todos los alojamientos ofrecen los mismos servicios.'],
      ['Acuerda tu reserva', 'Consulta disponibilidad, tarifa total, horarios de entrada y salida y política de cancelación. Guarda la confirmación y el contacto del establecimiento.']
    ],
    question: '¿Puedo consultar disponibilidad o reservar desde esta lista?',
    answer: 'La lista sirve para descubrir alojamientos y abrir sus fichas. Utiliza los canales de contacto publicados por cada establecimiento para confirmar disponibilidad, precios y condiciones de reserva.',
    links: [['/restaurantes-en-loja', 'Planea dónde comer'], ['/cafeterias-en-loja', 'Descubre cafeterías']]
  }
};
module.exports = key => {
  const plan = plans[key];
  if (!plan) return '';
  return `<section class="wrap category-planning" aria-labelledby="planning-title"><p class="eyebrow">Un plan pensado para ti</p><h2 id="planning-title">${plan.title}</h2><p class="planning-intro">${plan.intro}</p><div class="planning-grid">${plan.steps.map(([title, text], i) => `<article><span class="planning-number" aria-hidden="true">0${i + 1}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div><details class="planning-question"><summary>${plan.question}</summary><p>${plan.answer}</p></details><nav class="planning-links" aria-label="Completa tu visita"><a href="/que-hacer-en-loja">Qué hacer en la ciudad de Loja</a>${plan.links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}<a href="/#mapa">Explorar el mapa</a></nav></section>`;
};
