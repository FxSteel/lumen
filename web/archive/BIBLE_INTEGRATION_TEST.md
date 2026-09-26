# Bible Integration Testing Guide

## ✅ IMPLEMENTACIÓN COMPLETADA - FASES 2-4

### **FASE 2: API Client Optimizado** ✅
- ✅ Caching por capítulos implementado
- ✅ Sistema de mock data para desarrollo
- ✅ Manejo de errores y validaciones
- ✅ 3 versiones bíblicas en español (RVR1960, NVI, LBLA)
- ✅ 66 libros bíblicos con metadatos completos

### **FASE 3: Componente de Selección** ✅
- ✅ BibleVerseSelector.tsx con UI completa
- ✅ Dropdowns para versión, libro, capítulo, versículos
- ✅ Preview con debouncing (500ms)
- ✅ Validación de rangos y campos requeridos
- ✅ Integración con modal overlay

### **FASE 4: Integración con Sistema Existente** ✅
- ✅ Actualización de tipos en store.ts (bible_verse type)
- ✅ Helpers en bible-slides.ts para manejo de slides
- ✅ SongDetail.tsx actualizado con opción "Agregar versículo bíblico"
- ✅ OutputPreview.tsx con renderizado de versículos bíblicos
- ✅ Iconografía y etiquetas específicas para versículos

## Manual de Testing

### 1. Probar Selector de Versículos
1. Abrir una canción en el Operator
2. Hacer click en "Actions" → "Agregar versículo bíblico"
3. Seleccionar versión bíblica (RVR1960, NVI, LBLA)
4. Seleccionar libro del Antiguo o Nuevo Testamento
5. Ingresar capítulo y versículos (ej: 3:16 o 23:1-3)
6. Verificar que aparece el preview del versículo
7. Click en "Agregar versículo"

### 2. Verificar Integración con Slides
1. Confirmar que aparece nueva diapositiva tipo "Versículo"
2. Verificar icono de libro y etiqueta correcta
3. Ver referencia bíblica (ej: "Juan 3:16-17")
4. Verificar versión bíblica mostrada

### 3. Testing de Output en Vivo
1. Hacer click en la diapositiva de versículo bíblico
2. Verificar que aparece en OutputPreview con:
   - Referencia centrada (ej: "Juan 3:16-17")
   - Versión bíblica (ej: "RVR1960") 
   - Texto del versículo formateado
   - Loading spinner mientras carga

### 4. Navegación y Controles
1. Usar botones "Anterior/Siguiente" con slides mixtas
2. Verificar que versículos y letras se alternan correctamente
3. Probar modo Logo (debe mostrar título de canción)

## Versículos de Prueba Disponibles

**Juan 3:16-17** (RVR1960)
```
Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna. Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.
```

**Salmos 23:1** (RVR1960)
```
Jehová es mi pastor; nada me faltará.
```

**Filipenses 4:13** (RVR1960)
```
Todo lo puedo en Cristo que me fortalece.
```

## Funciones Implementadas

### API Service (/lib/youversion.ts)
- `getBibleVersions()` - Lista versiones bíblicas
- `getBibleBooks(bibleId)` - Libros de una versión
- `getChapter(bibleId, bookId, chapter)` - Capítulo completo
- `getVerseRange(bibleId, bookId, chapter, verses)` - Rango de versículos
- `parseVerseRange(input)` - Parser de referencias

### Helpers (/lib/bible-slides.ts)
- `createBibleVerseSlide()` - Crear slide de versículo
- `getBibleVerseSlideText()` - Obtener texto del versículo
- `parseBibleVerseSlideContent()` - Parser de contenido JSON
- `getSlideLabel()` - Etiqueta para cualquier tipo de slide
- `getSlideIconName()` - Icono apropiado por tipo

### Componentes Actualizados
- `BibleVerseSelector` - Modal para seleccionar versículos
- `SongDetail` - Menú Actions con opción bíblica  
- `OutputPreview` - Renderizado especial para versículos

## Status de Implementación

```
FASE 1: Setup inicial             ✅ COMPLETE
FASE 2: API Client optimizado     ✅ COMPLETE  
FASE 3: UI Selector               ✅ COMPLETE
FASE 4: Integración sistema       ✅ COMPLETE
FASE 5: Settings workspace        🔄 PENDING
FASE 6: Optimizaciones           🔄 PENDING  
FASE 7: Error handling           🔄 PENDING
FASE 8: Polish y testing         🔄 PENDING
```

## Próximos Pasos (FASES 5-8)

### FASE 5: Workspace Settings
- [ ] Columna `default_bible_version` en workspace_settings
- [ ] UI en página Settings para seleccionar versión por defecto
- [ ] BibleVerseSelector usa versión del workspace

### FASE 6: Optimización  
- [ ] React Query/SWR para caching inteligente
- [ ] Lazy loading de componentes pesados
- [ ] Optimización de re-renders

### FASE 7: Error Handling & UX
- [ ] Error boundaries para fallos de API
- [ ] Fallbacks cuando YouVersion API falla
- [ ] Mensajes informativos al usuario
- [ ] Loading states mejorados

### FASE 8: Polish & Testing
- [ ] Testing manual exhaustivo
- [ ] Refinamiento de UI/UX
- [ ] Performance profiling
- [ ] Documentación final

---

**RESULTADO ACTUAL:** Sistema funcional para agregar versículos bíblicos a presentaciones con UI completa, caching inteligente y integración perfecta con el sistema de slides existente.