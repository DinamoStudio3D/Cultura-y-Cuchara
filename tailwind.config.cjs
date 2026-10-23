// Build every complete utility used by public templates and generated content.
module.exports={
 content:['./*.html','./mi-negocio/*.html','./js/**/*.{js,cjs}','./api/**/*.js'],
 theme:{extend:{colors:{brandDark:'#121212',brandGold:'#EA580C',brandGoldHover:'#c2410c',brandCream:'#F9F8F6'},boxShadow:{'warm-glow':'0 10px 30px rgba(234,88,12,0.15)',glass:'0 8px 32px 0 rgba(0, 0, 0, 0.37)'}}},
 plugins:[]
};
