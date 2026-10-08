/*
 * Catálogo inicial sugerido para Misiones Chabaquito V2.
 *
 * Estas definiciones son PLANTILLAS EN BORRADOR: no escriben Firestore,
 * no activan misiones y no afectan a usuarios. Sirven como base editorial
 * para cargarlas desde el administrador cuando se apruebe el lanzamiento.
 */
(() => {
  'use strict';

  const INITIAL_MISSION_DRAFTS = Object.freeze([
    Object.freeze({
      id: 'primer-paso-chabaquito',
      title: 'Primer paso con Chabaquito',
      description: 'Realiza tu primera visita validada y comienza tu aventura explorando Loja con Chabaquito.',
      type: 'total_visits',
      targetCount: 1,
      status: 'draft',
      rewardType: 'digital',
      badge: Object.freeze({
        icon: '🐾',
        title: 'Primer Paso',
        description: 'Tu primera visita validada junto a Chabaquito.',
        rarity: 'common',
        imageUrl: ''
      })
    }),
    Object.freeze({
      id: 'explorador-lojano',
      title: 'Explorador Lojano',
      description: 'Descubre y valida tu visita en 3 lugares diferentes de Loja.',
      type: 'unique_places',
      targetCount: 3,
      status: 'draft',
      rewardType: 'digital',
      badge: Object.freeze({
        icon: '🎒',
        title: 'Explorador Lojano',
        description: 'Visitaste 3 lugares diferentes junto a Chabaquito.',
        rarity: 'uncommon',
        imageUrl: ''
      })
    }),
    Object.freeze({
      id: 'ruta-de-cinco',
      title: 'Ruta de 5',
      description: 'Continúa la aventura visitando 5 lugares diferentes de Loja.',
      type: 'unique_places',
      targetCount: 5,
      status: 'draft',
      rewardType: 'digital',
      badge: Object.freeze({
        icon: '🧭',
        title: 'Alma Viajera',
        description: 'Completaste una ruta de 5 lugares diferentes.',
        rarity: 'rare',
        imageUrl: ''
      })
    }),
    Object.freeze({
      id: 'descubriendo-provincia',
      title: 'Descubriendo la Provincia',
      description: 'Visita lugares validados en 3 cantones diferentes de la provincia de Loja.',
      type: 'canton_visits',
      targetCount: 3,
      cantonIds: Object.freeze(['loja','calvas','catamayo','celica','chaguarpamba','espindola','gonzanama','macara','olmedo','paltas','pindal','puyango','quilanga','saraguro','sozoranga','zapotillo']),
      status: 'draft',
      rewardType: 'digital',
      badge: Object.freeze({
        icon: '🗺️',
        title: 'Viajero Provincial',
        description: 'Exploraste al menos 3 cantones diferentes de Loja.',
        rarity: 'epic',
        imageUrl: ''
      })
    }),
    Object.freeze({
      id: 'dieciseis-cantones',
      title: '16 Cantones, una Provincia',
      description: 'El gran reto: registra visitas validadas en los 16 cantones de la provincia de Loja.',
      type: 'canton_visits',
      targetCount: 16,
      cantonIds: Object.freeze(['loja','calvas','catamayo','celica','chaguarpamba','espindola','gonzanama','macara','olmedo','paltas','pindal','puyango','quilanga','saraguro','sozoranga','zapotillo']),
      status: 'draft',
      rewardType: 'digital',
      badge: Object.freeze({
        icon: '🏆',
        title: 'Leyenda de Loja',
        description: 'Conquistaste los 16 cantones de la provincia de Loja.',
        rarity: 'legendary',
        imageUrl: ''
      })
    })
  ]);

  window.VisitaLojaChabaquitoMissionDrafts = INITIAL_MISSION_DRAFTS;
})();
