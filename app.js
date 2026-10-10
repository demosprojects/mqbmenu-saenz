let menuData = [];
let categoriaActiva = "";

// Orden de las secciones en la página (mismo orden que el header)
const ORDEN_SECCIONES = ['Burgers', 'Para compartir', 'Papas', 'Kids', 'Sin alcohol', 'Con alcohol', 'Agregados'];
const CATS_BEBIDAS = ['sin alcohol', 'con alcohol'];

const menuGrid        = document.getElementById('products-grid');
const sectionTitle    = document.getElementById('section-title');

// ─────────────────────────────────────────────
// Carga de datos → render único de TODO el menú
// ─────────────────────────────────────────────
async function cargarDatos() {
    try {
        const response = await fetch('menu.json');
        const dataRaw = await response.json();
        
        // Filtramos para ignorar los que tienen disponible: false
        menuData = dataRaw.filter(producto => producto.disponible !== false);
        
        renderTodo();
        initScrollSpy();
    } catch (error) {
        console.error("Error cargando el menú:", error);
    }
}

// ─────────────────────────────────────────────
// Render ÚNICO de todas las cards
// ─────────────────────────────────────────────
function renderTodo() {
    menuGrid.innerHTML = "";

    const categorias = [...new Set(menuData.map(p => p.categoria))];

    // ── Agrupar destacados por ofertaGrupo o nombre para el carousel ──
    const destacadosPorCategoria = {};
    categorias.forEach(cat => {
        const destacados = menuData.filter(p =>
            p.categoria.toLowerCase() === cat.toLowerCase() && p.destacado
        );
        if (destacados.length > 0) {
            // Agrupar por ofertaGrupo si existe, si no por imagen
            const grupos = {};
            destacados.forEach(p => {
                const key = p.ofertaGrupo || p.imagen;
                if (!grupos[key]) grupos[key] = [];
                grupos[key].push(p);
            });
            destacadosPorCategoria[cat] = Object.values(grupos);
        }
    });

    // ── Construir slides del carousel ──
    construirCarousel(destacadosPorCategoria);

    // Cards normales (no destacadas) → una sección por categoría
    const categoriasOrdenadas = [
        ...ORDEN_SECCIONES.filter(c => categorias.some(x => x.toLowerCase() === c.toLowerCase())),
        ...categorias.filter(c => !ORDEN_SECCIONES.some(x => x.toLowerCase() === c.toLowerCase()))
    ];

    categoriasOrdenadas.forEach(cat => {
        const catLower = cat.toLowerCase();
        const productos = menuData.filter(p => !p.destacado && p.categoria.toLowerCase() === catLower);
        if (!productos.length) return;

        const esBebida = CATS_BEBIDAS.includes(catLower);

        const sec = document.createElement('section');
        sec.dataset.cat    = catLower;
        sec.dataset.group  = esBebida ? 'bebidas' : 'comida';
        sec.dataset.activa = 'true';   // todas las secciones forman parte de la página

        const titulo = esBebida ? `Bebidas · ${cat}` : cat;

        sec.innerHTML = `
            <div class="flex items-center gap-4 mb-6">
                <h3 class="font-impact text-3xl text-mqb-blue tracking-tight uppercase italic">${titulo}</h3>
                <div class="h-px flex-1 bg-mqb-blue opacity-10"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>`;

        const grid = sec.querySelector('.grid');

        productos.forEach(producto => {
            const card       = document.createElement('div');
            const nombreSafe = producto.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            card.setAttribute('data-category', catLower);
            card.setAttribute('data-name',     producto.nombre);
            card.setAttribute('data-desc',     producto.descripcion);
            card.className = "group relative flex flex-col bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 hover:shadow-2xl hover:border-mqb-blue/30 transition-all duration-300";

            card.innerHTML = `
                <div class="relative aspect-[4/3] overflow-hidden bg-gray-100 cursor-pointer" onclick="openModal('${producto.imagen}', '${nombreSafe}')">
                    <img src="${imgUrl(producto.imagen, cat)}" alt="${producto.nombre}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                    <div class="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style="background:linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);"></div>
                    ${producto.sumaPuntos ? `
                    <div class="absolute top-3 right-3 z-10">
                        <span class="bg-[#014926]/95 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                            <i class="fa-solid fa-star text-[9px]" style="color:#a3f0c4;"></i> Suma puntos
                        </span>
                    </div>` : ''}
                    <div class="absolute bottom-3 left-3 z-10">
                        ${producto.precioAnterior ?
                            `<div class="bg-white rounded-xl shadow-xl px-3.5 py-1.5 flex items-baseline gap-2">
                                <span class="font-impact text-2xl text-red-600 leading-none">$${producto.precio.toLocaleString('es-AR')}</span>
                                <span class="text-xs text-gray-400 line-through font-impact leading-none">$${producto.precioAnterior.toLocaleString('es-AR')}</span>
                            </div>`
                            :
                            `<div class="bg-white rounded-xl shadow-xl px-3.5 py-1.5">
                                <span class="font-impact text-2xl text-mqb-blue leading-none">$${producto.precio.toLocaleString('es-AR')}</span>
                            </div>`
                        }
                    </div>
                </div>
                <div class="flex-1 p-5 space-y-2.5">
                    <h4 data-card-title class="font-impact text-[1.7rem] uppercase tracking-wide leading-none text-mqb-dark">${producto.nombre}</h4>
                    <div class="h-1 w-8 rounded-full bg-mqb-blue group-hover:w-16 transition-all duration-300"></div>
                    <p data-card-desc class="text-sm text-gray-600 font-medium leading-relaxed">${producto.descripcion}</p>
                </div>
            `;
            grid.appendChild(card);
        });

        menuGrid.appendChild(sec);
    });
}

// ─────────────────────────────────────────────
// Carousel global de ofertas (siempre visible)
// ─────────────────────────────────────────────
let carouselData    = {};
let carouselState   = { currentIndex: 0, grupos: [], autoplayTimer: null, progressEl: null };

function construirCarousel(destacadosPorCategoria) {
    carouselData = destacadosPorCategoria;
    // Recopilar TODOS los grupos de todas las categorías para el carousel global
    const todosLosGrupos = Object.values(carouselData).flat();
    if (todosLosGrupos.length > 0) {
        montarCarouselGlobal(todosLosGrupos);
    }
}

// ── Build HTML de un slide ──
function buildSlideHTML(grupo, slideIdx) {
    const [simple, doble] = grupo.length >= 2
        ? (grupo[0].precio <= grupo[1].precio ? [grupo[0], grupo[1]] : [grupo[1], grupo[0]])
        : [grupo[0], null];

    const cat      = simple.categoria;
    const imgSrc   = imgUrlFeatured(simple.imagen, cat);
    const nombreSafe = simple.nombre.replace(/'/g, "\\'");
    const ahorroSimple = simple.precioAnterior ? simple.precioAnterior - simple.precio : 0;
    const ahorroDoble  = doble && doble.precioAnterior ? doble.precioAnterior - doble.precio : 0;

    const nombreBase = simple.nombre.replace(/\s*(simple|doble|triple)\s*/gi, '').trim();
    const slug = slugify(nombreBase) + '-' + slideIdx;
    const tieneVariantes = !!doble;

    // Porcentaje de descuento
    const pctSimple = simple.precioAnterior
        ? Math.round((1 - simple.precio / simple.precioAnterior) * 100) : 0;

    return `
    <div class="carousel-slide relative overflow-hidden" style="background:linear-gradient(135deg,#060d09 0%,#0d1f14 55%,#0a1710 100%);">

        <div class="absolute inset-0 opacity-[0.03]" style="background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%221%22/></svg>');background-size:200px 200px;"></div>

        <div class="absolute top-0 right-0 w-[280px] h-[280px] rounded-full pointer-events-none" style="background:radial-gradient(circle,rgba(1,73,38,0.35) 0%,transparent 70%);transform:translate(30%,-30%);"></div>
        <div class="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full pointer-events-none" style="background:radial-gradient(circle,rgba(220,38,38,0.12) 0%,transparent 70%);transform:translate(-30%,30%);"></div>

        <div class="relative z-10 flex flex-col sm:flex-row items-stretch gap-0" style="min-height:220px;">

            <div class="relative w-full sm:w-[45%] shrink-0 cursor-pointer overflow-hidden group aspect-[4/3] sm:aspect-auto"
                 onclick="openModal('${simple.imagen}','${nombreSafe}')"
                 style="min-height:220px;">
                <img src="${imgSrc}"
                     alt="${nombreBase}"
                     loading="lazy"
                     class="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                     style="object-position:center;">
                <div class="absolute inset-0 hidden sm:block" style="background:linear-gradient(to right,transparent 40%,#0d1f14 100%);"></div>
                <div class="absolute inset-0 sm:hidden" style="background:linear-gradient(to bottom,transparent 30%,#0a1710 100%);"></div>

                ${pctSimple > 0 ? `
                <div class="absolute top-4 left-4 z-10">
                    <div class="oferta-event-pill text-white text-[12px] font-black px-3 py-1.5 rounded-lg uppercase shadow-lg">
                        −${pctSimple}% OFF
                    </div>
                </div>` : ''}

                ${(simple.sumaPuntos || (doble && doble.sumaPuntos)) ? `
                <div class="absolute top-4 right-4 z-10">
                    <span class="bg-[#014926] text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                        <i class="fa-solid fa-star text-[9px]" style="color:#a3f0c4;"></i> Suma puntos
                    </span>
                </div>` : ''}
            </div>

            <div class="flex-1 flex flex-col justify-center px-6 py-6 sm:py-8 sm:pl-4 sm:pr-8 slide-reveal z-10 relative">

                <div class="flex items-center gap-2 mb-3">
                    <span class="oferta-event-pill text-white text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-widest shadow-md flex items-center gap-1.5 w-fit">
                        Día de la Hamburguesa
                    </span>
                </div>

                <h3 class="font-impact text-[2.8rem] sm:text-5xl uppercase leading-none tracking-tight text-white mb-2 drop-shadow-lg"
                    style="line-height:0.92;">${nombreBase}</h3>
                <p class="text-white/60 text-xs font-medium leading-relaxed mb-5 line-clamp-2">${simple.descripcion}</p>

                ${tieneVariantes ? `
                <div class="flex gap-2 mb-4 bg-black/40 p-1.5 rounded-2xl w-max border border-white/10 shadow-inner" id="vt-${slug}">
                    <button class="variant-toggle active flex items-center justify-center gap-2 text-[11px] font-black uppercase px-4 py-2.5 rounded-xl tracking-wider cursor-pointer transform hover:scale-[1.02] active:scale-95 transition-all"
                        onclick="setVariant('${slug}',0,this)">
                        Simple
                    </button>
                    <button class="variant-toggle flex items-center justify-center gap-2 text-[11px] font-black uppercase px-4 py-2.5 rounded-xl tracking-wider cursor-pointer transform hover:scale-[1.02] active:scale-95 transition-all"
                        onclick="setVariant('${slug}',1,this)">
                        Doble
                    </button>
                </div>` : ''}

                <div id="ps-${slug}" class="mt-auto">
                    <div class="flex items-end gap-3 flex-wrap">
                        <div class="flex flex-col leading-none">
                            ${simple.precioAnterior ? `<span class="text-white/40 font-impact text-xl line-through mb-1">$${simple.precioAnterior.toLocaleString('es-AR')}</span>` : ''}
                            <span class="precio-oferta-num font-impact leading-none drop-shadow-xl" style="font-size:clamp(2.6rem,8vw,3.8rem);">$${simple.precio.toLocaleString('es-AR')}</span>
                        </div>
                        ${ahorroSimple > 0 ? `<span class="ahorro-chip text-xs font-black px-3 py-1.5 rounded-lg mb-1.5 uppercase tracking-wider shadow-sm">Ahorrás $${ahorroSimple.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                </div>

                ${tieneVariantes ? `
                <div id="pd-${slug}" style="display:none;" class="mt-auto">
                    <div class="flex items-end gap-3 flex-wrap">
                        <div class="flex flex-col leading-none">
                            ${doble.precioAnterior ? `<span class="text-white/40 font-impact text-xl line-through mb-1">$${doble.precioAnterior.toLocaleString('es-AR')}</span>` : ''}
                            <span class="precio-oferta-num font-impact leading-none drop-shadow-xl" style="font-size:clamp(2.6rem,8vw,3.8rem);">$${doble.precio.toLocaleString('es-AR')}</span>
                        </div>
                        ${ahorroDoble > 0 ? `<span class="ahorro-chip text-xs font-black px-3 py-1.5 rounded-lg mb-1.5 uppercase tracking-wider shadow-sm">Ahorrás $${ahorroDoble.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                </div>` : ''}
   
            </div>
        </div>
    </div>`;
}

window.setVariant = function(slug, idx, btn) {
    const vt = document.getElementById('vt-' + slug);
    if (!vt) return;
    vt.querySelectorAll('.variant-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const ps = document.getElementById('ps-' + slug);
    const pd = document.getElementById('pd-' + slug);
    
    const activePrice = idx === 0 ? ps : pd;
    const hiddenPrice = idx === 0 ? pd : ps;
    
    if (hiddenPrice) hiddenPrice.style.display = 'none';
    if (activePrice) {
        activePrice.style.display = '';
        activePrice.style.animation = 'none';
        activePrice.offsetHeight; // forzar reflow
        activePrice.style.animation = 'slideReveal 0.3s ease forwards';
    }
};

function montarCarouselGlobal(grupos) {
    const track   = document.getElementById('carousel-track-global');
    const dots    = document.getElementById('carousel-dots-global');
    const prevBtn = document.getElementById('carousel-prev-global');
    const nextBtn = document.getElementById('carousel-next-global');
    const progress = document.getElementById('carousel-progress');

    if (!track || !dots) return;

    track.innerHTML = '';
    dots.innerHTML  = '';

    grupos.forEach((grupo, i) => {
        track.insertAdjacentHTML('beforeend', buildSlideHTML(grupo, i));
        const dot = document.createElement('div');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => irASlide(i);
        dots.appendChild(dot);
    });

    carouselState.grupos = grupos;
    carouselState.currentIndex = 0;
    carouselState.progressEl = progress;

    function resetProgress() {
        if (!progress) return;
        progress.style.animation = 'none';
        progress.offsetHeight; // reflow
        progress.style.animation = '';
        progress.classList.remove('carousel-progress-bar');
        void progress.offsetWidth;
        progress.classList.add('carousel-progress-bar');
    }

    function irASlide(idx) {
        carouselState.currentIndex = (idx + grupos.length) % grupos.length;
        track.style.transform = `translateX(-${carouselState.currentIndex * 100}%)`;
        dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
            d.classList.toggle('active', i === carouselState.currentIndex);
        });
        resetProgress();
    }

    carouselState.irASlide = irASlide;

    if (prevBtn) prevBtn.onclick = () => irASlide(carouselState.currentIndex - 1);
    if (nextBtn) nextBtn.onclick = () => irASlide(carouselState.currentIndex + 1);

    // Mostrar flechas/dots solo si hay más de 1 slide
    const multi = grupos.length > 1;
    if (prevBtn) prevBtn.style.display = multi ? '' : 'none';
    if (nextBtn) nextBtn.style.display = multi ? '' : 'none';
    dots.style.display = multi ? '' : 'none';

    // Autoplay
    if (carouselState.autoplayTimer) clearInterval(carouselState.autoplayTimer);
    if (multi) {
        resetProgress();
        carouselState.autoplayTimer = setInterval(() => {
            irASlide(carouselState.currentIndex + 1);
        }, 9000);
    }

    // Touch swipe
    const el = document.getElementById('ofertas-carousel-global');
    if (!el) return;

    let tx = 0, ty = 0, dragging = false;

    el.addEventListener('touchstart', e => {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
        dragging = true;
        if (carouselState.autoplayTimer) clearInterval(carouselState.autoplayTimer);
    }, { passive: true });

    el.addEventListener('touchend', e => {
        if (!dragging) return;
        dragging = false;
        const dx = e.changedTouches[0].clientX - tx;
        const dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 38) {
            irASlide(carouselState.currentIndex + (dx < 0 ? 1 : -1));
        }
        if (multi) {
            carouselState.autoplayTimer = setInterval(() => {
                irASlide(carouselState.currentIndex + 1);
            }, 9000);
        }
    }, { passive: true });
}

// ─────────────────────────────────────────────
// Cambio de categoría: show/hide + scroll arriba
// ─────────────────────────────────────────────
function alturaHeader() {
    return document.querySelector('header')?.offsetHeight ?? 72;
}

function mostrarCategoria(categoria) {
    const catLower = categoria.toLowerCase();
    const target = menuGrid.querySelector(`section[data-cat="${catLower}"]`);
    if (!target) return;

    // Si hay búsqueda activa, la limpiamos para que la sección sea visible
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    }

    // Marcamos el botón ya y pausamos el scroll-spy mientras dura la animación
    marcarActivo(catLower);
    spyPausadoHasta = Date.now() + 900;

    // Bajando: el header se oculta, así que no hace falta dejarle lugar.
    // Subiendo: el header aparece, así que dejamos su altura libre arriba.
    const objetivoY = target.getBoundingClientRect().top + window.scrollY;
    const bajando   = objetivoY > window.scrollY;
    setHeaderOculto(bajando);
    lastScrollY = window.scrollY;

    const y = objetivoY - (bajando ? 0 : alturaHeader()) - 12;
    window.scrollTo({ top: y, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// Header: se oculta al bajar, aparece al subir
// ─────────────────────────────────────────────
let headerOculto = false;
let lastScrollY  = 0;

function setHeaderOculto(valor) {
    if (headerOculto === valor) return;
    headerOculto = valor;
    const header = document.querySelector('header');
    if (header) header.classList.toggle('header-oculto', valor);
    if (valor) closeBebidasDropdown();   // el desplegable no puede quedar flotando sin header
}

function actualizarHeader() {
    const y = Math.max(0, window.scrollY);   // evita valores negativos (rebote iOS)

    // Durante un scroll programático (click en un botón) no tocamos el header
    if (Date.now() < spyPausadoHasta) { lastScrollY = y; return; }

    const dy = y - lastScrollY;
    if (y <= alturaHeader()) {
        setHeaderOculto(false);               // arriba de todo: siempre visible
        lastScrollY = y;
    } else if (dy > 6) {
        setHeaderOculto(true);                // bajando
        lastScrollY = y;
    } else if (dy < -6) {
        setHeaderOculto(false);               // subiendo
        lastScrollY = y;
    }
}

// ─────────────────────────────────────────────
// Scroll-spy: marca en el header la sección visible
// ─────────────────────────────────────────────
let spyPausadoHasta = 0;
let catMarcada = null;
const botonesPorCat = {};

function marcarActivo(catLower) {
    if (catMarcada === catLower) return;
    catMarcada = catLower;

    document.querySelectorAll('#category-nav .category-btn.active, #bebidas-dropdown .sub-btn.active')
        .forEach(b => b.classList.remove('active'));

    const esBebida = CATS_BEBIDAS.includes(catLower);
    const btn = botonesPorCat[catLower];
    if (btn) btn.classList.add('active');
    // Si es una bebida, el botón "Bebidas" del header también queda marcado
    if (esBebida) {
        const toggle = document.getElementById('bebidas-toggle');
        if (toggle) toggle.classList.add('active');
    }

    // Desktop: mantener visible el botón activo dentro del nav con scroll horizontal
    const nav = document.getElementById('category-nav');
    const visible = esBebida ? document.getElementById('bebidas-toggle') : btn;
    if (nav && visible && nav.scrollWidth > nav.clientWidth) {
        const left = visible.offsetLeft - (nav.clientWidth - visible.offsetWidth) / 2;
        nav.scrollTo({ left, behavior: 'smooth' });
    }
}

function actualizarSpy() {
    if (Date.now() < spyPausadoHasta) return;

    const secciones = Array.from(menuGrid.querySelectorAll('section[data-cat]'))
        .filter(sec => sec.style.display !== 'none');
    if (!secciones.length) return;

    const umbral = (headerOculto ? 0 : alturaHeader()) + 60;
    let actual = secciones[0];
    for (const sec of secciones) {
        if (sec.getBoundingClientRect().top <= umbral) actual = sec;
        else break;
    }

    // Al llegar al final de la página, la última sección queda marcada
    const alFinal = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (alFinal) actual = secciones[secciones.length - 1];

    marcarActivo(actual.dataset.cat);
}

function initScrollSpy() {
    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { actualizarHeader(); actualizarSpy(); ticking = false; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Cuando termina un scroll programático, re-sincronizamos
    window.addEventListener('scrollend', () => { spyPausadoHasta = 0; lastScrollY = Math.max(0, window.scrollY); actualizarSpy(); });
    // Y por si el navegador no soporta scrollend:
    lastScrollY = Math.max(0, window.scrollY);
    setTimeout(actualizarSpy, 50);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const CATS_SIN_OPTIMIZAR = ['con alcohol', 'sin alcohol', 'agregados'];

function imgUrl(url, categoria) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (CATS_SIN_OPTIMIZAR.includes((categoria || '').toLowerCase())) return url;
    return url.replace('/upload/', '/upload/w_600,q_auto,f_auto/');
}

function imgUrlFeatured(url, categoria) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (CATS_SIN_OPTIMIZAR.includes((categoria || '').toLowerCase())) return url;
    return url.replace('/upload/', '/upload/w_900,q_auto,f_auto/');
}

// ─────────────────────────────────────────────
// Dropdown Bebidas
// ─────────────────────────────────────────────
let closeBebidasDropdown = () => {};

function initDropdown() {
    const toggle   = document.getElementById('bebidas-toggle');
    const dropdown = document.getElementById('bebidas-dropdown');
    const chevron  = document.getElementById('bebidas-chevron');

    if (!toggle || !dropdown) return;

    let isOpen = false;

    function openDropdown() {
        const rect      = toggle.getBoundingClientRect();
        const isMobile  = window.innerWidth < 768;
        const dropdownW = 220;
        const margin    = 12;

        dropdown.style.top = (rect.bottom + 8) + 'px';

        if (isMobile) {
            let left = rect.right - dropdownW;
            if (left < margin) left = margin;
            if (left + dropdownW > window.innerWidth - margin) left = window.innerWidth - dropdownW - margin;
            dropdown.style.left = left + 'px';
        } else {
            let left = rect.left;
            if (left + dropdownW > window.innerWidth - margin) left = window.innerWidth - dropdownW - margin;
            dropdown.style.left = left + 'px';
        }
        dropdown.style.right = 'auto';
        dropdown.classList.remove('hidden');
        dropdown.style.display  = 'flex';
        chevron.style.transform = 'rotate(180deg)';
        isOpen = true;
    }

    function closeDropdown() {
        dropdown.classList.add('hidden');
        dropdown.style.display  = 'none';
        chevron.style.transform = 'rotate(0deg)';
        isOpen = false;
    }

    closeBebidasDropdown = closeDropdown;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen ? closeDropdown() : openDropdown();
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== toggle) closeDropdown();
    });

    window.addEventListener('resize', () => {
        if (isOpen) openDropdown();
    });
}

// ─────────────────────────────────────────────
// Listeners de categorías
// ─────────────────────────────────────────────
function initCategoryButtons() {
    document.querySelectorAll('#category-nav .category-btn:not(.sub-btn)').forEach(btn => {
        if (btn.id === 'bebidas-toggle') return;
        const cat = btn.textContent.trim().toLowerCase();
        botonesPorCat[cat] = btn;
        btn.addEventListener('click', () => mostrarCategoria(btn.textContent.trim()));
    });

    document.querySelectorAll('#bebidas-dropdown .sub-btn').forEach(btn => {
        const cat = btn.textContent.trim().toLowerCase();
        botonesPorCat[cat] = btn;
        btn.addEventListener('click', () => {
            closeBebidasDropdown();
            mostrarCategoria(btn.textContent.trim());
        });
    });
}

// ─────────────────────────────────────────────
// Modal con zoom
// ─────────────────────────────────────────────
const modal          = document.getElementById('image-modal');
const modalImg       = document.getElementById('modal-img');
const modalContainer = document.getElementById('modal-container');

let zoomLevel   = 1;
const ZOOM_MIN  = 1;
const ZOOM_MAX  = 4;
const ZOOM_STEP = 0.5;

function applyZoom() {
    if (!modalImg) return;
    modalImg.style.transform  = `scale(${zoomLevel})`;
    modalImg.style.cursor     = zoomLevel > 1 ? 'grab' : 'default';
    const valueEl = document.getElementById('modal-zoom-value');
    const outBtn  = document.getElementById('modal-zoom-out');
    const inBtn   = document.getElementById('modal-zoom-in');
    if (valueEl) valueEl.innerText    = Math.round(zoomLevel * 100) + '%';
    if (outBtn)  outBtn.style.opacity = zoomLevel <= ZOOM_MIN ? '0.3' : '1';
    if (inBtn)   inBtn.style.opacity  = zoomLevel >= ZOOM_MAX ? '0.3' : '1';
}

window.openModal = (src, nombre) => {
    if (!modal || !modalImg) return;
    zoomLevel = 1;
    modalImg.src = src;
    modalImg.style.transform = 'scale(1)';
    const nameEl = document.getElementById('modal-product-name');
    if (nameEl) nameEl.innerText = nombre || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContainer.classList.remove('scale-95');
        modalContainer.classList.add('scale-100');
        applyZoom();
    }, 10);
    document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
    if (!modal) return;
    modal.classList.add('opacity-0');
    modalContainer.classList.remove('scale-100');
    modalContainer.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modalImg) modalImg.src = '';
        zoomLevel = 1;
        document.body.style.overflow = '';
    }, 300);
};

window.zoomIn = () => {
    if (zoomLevel < ZOOM_MAX) {
        zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
        applyZoom();
    }
};

window.zoomOut = () => {
    if (zoomLevel > ZOOM_MIN) {
        zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
        applyZoom();
    }
};

if (modal) {
    modal.addEventListener('wheel', (e) => {
        if (modal.classList.contains('hidden')) return;
        e.preventDefault();
        e.deltaY < 0 ? window.zoomIn() : window.zoomOut();
    }, { passive: false });
}

let lastPinchDist = null;

if (modal) {
    modal.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastPinchDist !== null) {
            const delta = dist - lastPinchDist;
            if (Math.abs(delta) > 5) {
                zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + (delta > 0 ? ZOOM_STEP : -ZOOM_STEP)));
                applyZoom();
            }
        }
        lastPinchDist = dist;
    }, { passive: false });

    modal.addEventListener('touchend', () => { lastPinchDist = null; });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modal && !modal.classList.contains('hidden')) window.closeModal();
        // Permite cerrar el modal promo con ESC también
        const promoModal = document.getElementById('promo-modal');
        if (promoModal && !promoModal.classList.contains('hidden')) window.closePromoModal();
    }
});

// ─────────────────────────────────────────────
// Modal Promocional (App de Puntos) — DESACTIVADO
// El banner del header ya muestra la info de la app
// ─────────────────────────────────────────────
function initPromoModal() {
    // Modal desactivado: la info de la app ahora está en el banner principal
}

window.closePromoModal = () => {
    const promoModal = document.getElementById('promo-modal');
    const promoContent = document.getElementById('promo-modal-content');
    if (!promoModal) return;

    promoModal.classList.add('opacity-0');
    promoContent.classList.remove('scale-100');
    promoContent.classList.add('scale-95');
    
    setTimeout(() => {
        promoModal.classList.add('hidden');
        promoModal.classList.remove('flex');
        // Restaurar scroll
        document.body.style.overflow = '';
    }, 300);
};

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initDropdown();
    initCategoryButtons();
    cargarDatos();
    initPromoModal(); // Inicializa el modal de promo
});
