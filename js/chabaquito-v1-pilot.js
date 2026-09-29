(function (root) {
  'use strict';
  // Catálogo visible: sin claves de respuestas ni concesión de XP.
  const objectives = Object.freeze([
    Object.freeze({ id: 'descubre', type: 'digital_objective', title: 'Conoce a Chabaquito',
      description: '¡Hola! Soy Chabaquito. Seré tu compañero mientras exploras Loja. Juntos descubriremos lugares, historias, sabores y rincones de nuestra provincia.',
      question: '¿Cuál es la misión de Chabaquito?', options: ['Acompañarte a descubrir Loja', 'Venderte entradas para los atractivos', 'Reservar automáticamente tus viajes'] }),
    Object.freeze({ id: 'cultura', type: 'digital_objective', title: 'El desafío lojano',
      description: 'Responde al menos dos de las tres preguntas culturales.', questions: Object.freeze([
        Object.freeze({ text: '¿Cuál es la capital de la provincia de Loja?', options: ['Catamayo', 'Loja', 'Saraguro'] }),
        Object.freeze({ text: '¿En qué región del Ecuador se encuentra la provincia de Loja?', options: ['Costa', 'Sierra', 'Amazonía'] }),
        Object.freeze({ text: 'TODO_CONTENT: tercera pregunta cultural pendiente de verificar.', options: [], pending: true })
      ]) }),
    Object.freeze({ id: 'autonoma-uno', type: 'self_visit', pointId: 'POINT_A', title: 'Encuentra la primera huella',
      description: 'Chabaquito ha salido a recorrer Loja y dejó una de sus huellas en este lugar.' }),
    Object.freeze({ id: 'con-encargado', type: 'confirmed_visit', pointId: 'ESTABLISHMENT_B', title: 'Conoce a un amigo de Chabaquito',
      description: 'Chabaquito tiene amigos por toda Loja. Visita el establecimiento indicado, conoce el lugar y registra tu visita con ayuda del encargado. No requiere compra ni consumo.' }),
    Object.freeze({ id: 'autonoma-dos', type: 'self_visit', pointId: 'POINT_C', title: 'La huella final',
      description: '¡Solo falta una! Chabaquito ha dejado su última huella en otro rincón de Loja. Encuéntrala para completar tu primera aventura.' })
  ]);
  const english = Object.freeze({
    descubre: Object.freeze({ title: 'Meet Chabaquito', description: 'Hi! I am Chabaquito. I will accompany you as you explore Loja. Together we will discover places, stories, flavors and corners of our province.', question: 'What is Chabaquito’s mission?', options: ['Help you discover Loja', 'Sell attraction tickets', 'Automatically book your trips'] }),
    cultura: Object.freeze({ title: 'The Loja challenge', description: 'Answer at least two of the three cultural questions.', questions: [
      { text: 'What is the capital of Loja province?', options: ['Catamayo', 'Loja', 'Saraguro'] },
      { text: 'Which region of Ecuador is Loja province in?', options: ['Coast', 'Andes', 'Amazon'] },
      { text: 'TODO_CONTENT: third cultural question pending verification.', options: [], pending: true }
    ] }),
    'autonoma-uno': Object.freeze({ title: 'Find the first footprint', description: 'Chabaquito explored Loja and left a footprint at this place.' }),
    'con-encargado': Object.freeze({ title: 'Meet a friend of Chabaquito', description: 'Visit the designated establishment and register your visit with its staff. No purchase is required.' }),
    'autonoma-dos': Object.freeze({ title: 'The final footprint', description: 'One more to go! Find Chabaquito’s last footprint in another corner of Loja.' })
  });
  const api = Object.freeze({ objectives, english });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VisitaLojaChabaquitoV1Pilot = api;
})(typeof window !== 'undefined' ? window : null);
