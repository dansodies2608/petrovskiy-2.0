const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwK_hEALq1EjnL2Sf2U71PFAqvJgvM4bI2QPREdGUcGqE2iZceZr1T13VtwnnDPPfo/exec";
const SECRET_KEY = "b3821cce5703d067b14f4e63c9e65fd86ce24f5de0438f8a69a006167f2899ca";

// --------------------------------------- ОСНОВНОЙ КОД ------------------------------------------------ //

let dashboardData = null;

document.addEventListener("DOMContentLoaded", function () {
  initDashboard();
});

function initDashboard() {
  createLoadingIndicator();
  showLoading(true);
  setupTabHandlers();
  setupDateSelector();
  loadData(true);
}

function setupTabHandlers() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      // Прокрутка вверх перед переключением
      window.scrollTo({
        top: 0,
        behavior: "smooth" // Плавная прокрутка
      });

      tabs.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      const tabId = getTabId(this.dataset.count);
      document.getElementById(tabId).classList.add("active");

      updateHeader();

      if (dashboardData) {
        refreshTabData(tabId);
      }
    });
  });
}

function getTabId(count) {
  const tabs = {
    0: "new-cars-tab",
    1: "used-cars-tab",
    2: "service-tab",
    3: "mkc-tab",
    4: "balance-tab",
  };
  return tabs[count] || "new-cars-tab";
}

function setupDateSelector() {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const applyBtn = document.getElementById('apply-date');
  
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  monthSelect.value = currentMonth;
  
  yearSelect.innerHTML = '';
  for (let year = currentYear - 2; year <= currentYear; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
  
  yearSelect.value = currentYear;
  
  applyBtn.addEventListener('click', () => {
    showLoading(true);
    loadData(false);
  });
}

async function loadData(isInitialLoad) {
  try {
    const monthSelect = document.getElementById("month-select");
    const yearSelect = document.getElementById("year-select");
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);
    const today = new Date();

    if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) {
      showError("Нельзя выбрать будущую дату");
      return;
    }

    const salesUrl = `${SCRIPT_URL}?key=${SECRET_KEY}&month=${month}&year=${year}&type=sales`;
    const salesResponse = await fetch(salesUrl);
    if (!salesResponse.ok) throw new Error(`Ошибка HTTP: ${salesResponse.status}`);

    const salesData = await salesResponse.json();
    if (salesData.status !== "success") throw new Error(salesData.message);

    const serviceUrl = `${SCRIPT_URL}?key=${SECRET_KEY}&month=${month}&year=${year}&type=service`;
    const serviceResponse = await fetch(serviceUrl);
    const serviceData = await serviceResponse.json();

    const mkcUrl = `${SCRIPT_URL}?key=${SECRET_KEY}&month=${month}&year=${year}&type=mkc`;
    const mkcResponse = await fetch(mkcUrl);
    const mkcData = await mkcResponse.json();

    const balanceUrl = `${SCRIPT_URL}?key=${SECRET_KEY}&type=balance`;
    const balanceResponse = await fetch(balanceUrl);
    const balanceData = await balanceResponse.json();

    dashboardData = {
      ...salesData,
      serviceData: serviceData.data,
      mkcData: mkcData.data,
      balanceData: balanceData.data || balanceData,
      currentMonth: salesData.currentMonth,
      selectedMonth: salesData.selectedMonth,
      selectedYear: salesData.selectedYear,
    };
    console.log(dashboardData);

    processAndDisplayData(dashboardData);
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    showError("Не удалось загрузить данные. Пожалуйста, попробуйте позже.");
  } finally {
    showLoading(false);
  }
}

function processAndDisplayData(data) {
  dashboardData = data;
  updateHeader();

  // Обработка новых автомобилей
  if (data.newCars) {
    const processedNewCars = processSalesData(
      data.newCars.currentData,
      data.newCars.prevData,
      data.newCars.prevYearData,
      data.newCars.plans
    );
    updateNewCarsTab(processedNewCars);
  }

  // Обработка авто с пробегом
  if (data.usedCars) {
    const processedUsedCars = processSalesData(
      data.usedCars.currentData,
      data.usedCars.prevData,
      data.usedCars.prevYearData,
      data.usedCars.plans
    );
    
    // 2. Добавляем ASP данные, если они есть (независимо от продаж)
    if (data.usedCars.aspData) {
      // Агрегируем общие данные по ASP
      const aggregatedASPData = calculateAggregatedASPData(data.usedCars.aspData);
      processedUsedCars.aggregatedASPData = aggregatedASPData;
    }
    
    updateUsedCarsTab(processedUsedCars);
  }

  if (data.serviceData) updateServiceTab(data.serviceData);
  if (data.mkcData) updateMKCTab(data.mkcData);
  if (data.balanceData) updateBalanceTab(data.balanceData);
}

function updateMKCTab(data) {
  const container = document.getElementById("mkc-tab");
  if (!container) return;

  container.innerHTML = "";

  for (const point in data) {
    const pointData = data[point];
    if (pointData.nh.plan > 0 && pointData.gm1.plan > 0) {
    const card = document.createElement("div");
    card.className = "service-card";

    card.innerHTML = `
      <h3>${point}</h3>
      <div class="service-stats">
        <div class="service-stat">
          <div class="service-stat-label">Нормо-часы (план/факт)</div>
          <div class="service-stat-value">${formatNumber(pointData.nh.plan)} / ${formatNumber(pointData.nh.fact)}</div>
          <div class="service-stat-label">Отклонение</div>
          <div class="service-stat-value ${getDeviationClass(pointData.nh.deviation)}">
            ${formatDeviation(pointData.nh.deviation)}
          </div>
        </div>
        <div class="service-stat">
          <div class="service-stat-label">GM-1 (план/факт)</div>
          <div class="service-stat-value">${formatNumber(pointData.gm1.plan)} / ${formatNumber(pointData.gm1.fact)}</div>
          <div class="service-stat-label">Отклонение</div>
          <div class="service-stat-value ${getDeviationClass(pointData.gm1.deviation)}">
            ${formatDeviation(pointData.gm1.deviation)}
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
    }
  }
}

function processSalesData(currentData, prevData, prevYearData, plans) {
  const result = {};
  const allPoints = new Set();

  // Собираем все точки продаж
  [currentData, prevData, prevYearData].forEach(data => {
    data.forEach(item => {
      if (item && item.salesPoint) {
        allPoints.add(item.salesPoint === "Каширское ш." ? "Каширка" : item.salesPoint);
      }
    });
  });

  // Жёстко заданный порядок точек
  const orderedPoints = [
    'Софийская',
    'Руставели',
    'Каширка'
  ];

  // Добавляем остальные точки (кроме уже указанных), сохраняя исходный порядок
  allPoints.forEach(point => {
    if (!orderedPoints.includes(point)) {
      orderedPoints.push(point);
    }
  });

  // Обрабатываем точки в нужном порядке
  orderedPoints.forEach(point => {
    // if (plans?.[point]?.total > 0) {
      result[point] = {
        current: processPeriodData(currentData, point),
        prevMonth: processPeriodData(prevData, point),
        prevYear: processPeriodData(prevYearData, point),
        plan: plans[point] || { total: 0 }
      };
    // }
  });

  return result;
}

function isSpbPoint(point) {
  return ['Софийская', 'Выборгский', 'Руставели'].includes(point);
}

function processPeriodData(data, point) {
  const filtered = data.filter((item) => {
    const salesPoint = item.salesPoint === "Каширское ш." ? "Каширка" : item.salesPoint;
    return salesPoint === point && (item.soldCount || item.jok); // Учитываем записи с soldCount или jok
  });

  const result = {
    brands: {},
    total: 0,
    jok: 0,
  };

  filtered.forEach((item) => {
    const brand = item.brand || "Другие";
    const soldCount = item.soldCount || 0; // Теперь всегда 1
    const jok = item.jok || 0;
    
    result.brands[brand] = result.brands[brand] || { count: 0, jok: 0 };
    result.brands[brand].count += soldCount; // Увеличиваем на 1
    result.brands[brand].jok += jok;
    result.total += soldCount; // Суммируем общее количество
    result.jok += jok;
  });

  return result;
}

function updateNewCarsTab(data) {
  const container = document.querySelector("#new-cars-tab .cards-container");
  if (!container) return;

  container.innerHTML = "";

  for (const point in data) {
    // const card = (point, data[point], "new");
    const card = createSalesCard(point, data[point], "new");
    container.appendChild(card);
  }
}

function updateUsedCarsTab(data) {
  const container = document.querySelector("#used-cars-tab .cards-container");
  if (!container) return;

  container.innerHTML = "";

  // 1. Добавляем карточки по точкам продаж
  for (const point in data) {
    if (point !== 'aggregatedASPData' && data[point]) {
      // const card = (point, data[point], "used");
      const card = createSalesCard(point, data[point], "used");
      container.appendChild(card);
    }
  }

  // 2. Добавляем общую сводку по ASP
  if (data.aggregatedASPData) {
    const summaryCard = document.createElement("div");
    summaryCard.className = "card asp-summary-card";
    summaryCard.innerHTML = `
      <h2>Сводные данные по приему</h2>
      <div class="asp-summary-container"></div>
    `;
    
    const summaryContainer = summaryCard.querySelector(".asp-summary-container");
    
    const dealTypes = ['Выкуп', 'Trade-In', 'Внутренний Trade-In', 'Комиссия'];
    
    dealTypes.forEach(type => {
      if (data.aggregatedASPData[type]) {
        const typeData = data.aggregatedASPData[type];
        const deviation = typeData.plan ? ((typeData.fact - typeData.plan) / typeData.plan) * 100 : 0;
        const avgPrice = typeData.fact ? typeData.sum / typeData.fact : 0;
        
        const statElement = document.createElement("div");
        statElement.className = "asp-summary-stat";
        statElement.innerHTML = `
          <h3>${type}</h3>
          <div class="asp-summary-grid">
            <div class="asp-summary-item">
              <span class="asp-summary-label">План</span>
              <span class="asp-summary-value">${typeData.plan} шт</span>
            </div>
            <div class="asp-summary-item">
              <span class="asp-summary-label">Факт</span>
              <span class="asp-summary-value">${typeData.fact} шт</span>
            </div>
            <div class="asp-summary-item">
              <span class="asp-summary-label">Отклонение</span>
              <span class="asp-summary-value ${getDeviationClass(deviation)}">
                ${formatDeviation(deviation)}
              </span>
            </div>
            <div class="asp-summary-item">
              <span class="asp-summary-label">Сумма</span>
              <span class="asp-summary-value">${formatNumber(typeData.sum)} ₽</span>
            </div>
            <div class="asp-summary-item">
              <span class="asp-summary-label">Средняя цена</span>
              <span class="asp-summary-value">${formatNumber(avgPrice)} ₽</span>
            </div>
          </div>
        `;
        summaryContainer.appendChild(statElement);
      }
    });
    
    container.appendChild(summaryCard);
  }
}

function createSalesCard(point, pointData, type) {
  const { current, prevMonth, prevYear, plan, aspData } = pointData;
  const isNewCars = type === "new";

  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <h2>${point}</h2>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">План</span>
        <span class="stat-value">${plan?.total || 0} шт</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Факт</span>
        <span class="stat-value">${current.total} шт</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Откл.</span>
        <span class="stat-value ${getDeviationClass(calculateDeviation(current.total, plan?.total || 0))}">
          ${formatDeviation(calculateDeviation(current.total, plan?.total || 0))}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">ЖОК</span>
        <span class="stat-value">${formatNumber(current.jok)} ₽</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">ЖОК/ед</span>
        <span class="stat-value">${current.total > 0 ? formatNumber(current.jok / current.total) : "0"} ₽</span>
      </div>
    </div>

    <div class="sales-dynamics">
      <h3 class="dynamics-header">
        <span>Динамика продаж</span>
        ${isNewCars ? '<button class="toggle-brands" style="display: none;">+</button>' : ''}
      </h3>
      
      <div class="dynamics-overview">
        <div class="period-column">
          <div class="period-header">Период</div>
          <div class="period-value">Текущий</div>
          <div class="period-value">Предыдущий</div>
          <div class="period-value">АППГ</div>
        </div>
        <div class="data-column">
          <div class="brand-header">Итого</div>
          <div class="brand-value">${current.total}</div>
          <div class="brand-value">${prevMonth.total || 0}</div>
          <div class="brand-value">${prevYear.total > 0 ? prevYear.total : "N/A"}</div>
        </div>
        <div class="growth-column">
          <div class="growth-header">Рост</div>
          <div class="growth-value"></div>
          <div class="growth-value ${getGrowthClass(calculateGrowth(current.total, prevMonth.total))}">
            ${formatGrowth(calculateGrowth(current.total, prevMonth.total))}
          </div>
          <div class="growth-value ${getGrowthClass(calculateGrowth(current.total, prevYear.total))}">
            ${prevYear.total > 0 ? formatGrowth(calculateGrowth(current.total, prevYear.total)) : "N/A"}
          </div>
        </div>
      </div>
      
      <div class="brands-container"></div>
    </div>
  `;

  const toggleBtn = card.querySelector('.toggle-brands');
  const brandsContainer = card.querySelector('.brands-container');

  if (isNewCars && toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      const isExpanded = brandsContainer.classList.contains('expanded');
      
      if (isExpanded) {
        brandsContainer.classList.remove('expanded');
        toggleBtn.textContent = '+';
      } else {
        const allBrands = getAllBrands(current, prevMonth, prevYear, plan);
        
        brandsContainer.innerHTML = '';
        allBrands.forEach(brand => {
          const brandRow = createBrandRow(brand, current, prevMonth, prevYear);
          brandsContainer.appendChild(brandRow);
        });
        
        brandsContainer.classList.add('expanded');
        toggleBtn.textContent = '-';
      }
    });
  }

  return card;
}

// Вспомогательные функции
function getAllBrands(current, prevMonth, prevYear, plan) {
  const allBrands = new Set();
  
  [current.brands, prevMonth.brands, prevYear.brands, plan.brands].forEach(data => {
    for (const brand in data) {
      allBrands.add(brand);
    }
  });
  
  return Array.from(allBrands).sort();
}

function createBrandRow(brand, current, prevMonth, prevYear) {
  const currentBrand = current.brands[brand] || { count: 0 };
  const prevBrand = prevMonth.brands[brand] || { count: 0 };
  const prevYearBrand = prevYear.brands[brand] || { count: 0 };

  const row = document.createElement('div');
  row.className = 'brand-row';
  
  row.innerHTML = `
    <h3 class="dynamics-header">
      <span>${brand}</span>
    </h3>
    
    <div class="dynamics-overview brend">
      <div class="period-column">
        <div class="period-header">Период</div>
        <div class="period-value">Текущий</div>
        <div class="period-value">Предыдущий</div>
        <div class="period-value">АППГ</div>
      </div>
      <div class="data-column">
        <div class="brand-header">Итого</div>
        <div class="brand-value">${currentBrand.count}</div>
        <div class="brand-value">${prevBrand.count || 0}</div>
        <div class="brand-value">${prevYearBrand.count > 0 ? prevYearBrand.count : "N/A"}</div>
      </div>
      <div class="growth-column">
        <div class="growth-header">Рост</div>
        <div class="growth-value ${getGrowthClass(calculateGrowth(currentBrand.count, prevBrand.count))}">
        ${formatGrowth(calculateGrowth(currentBrand.count, prevBrand.count))}
        </div>
        <div class="growth-value ${getGrowthClass(calculateGrowth(currentBrand.count, prevYearBrand.count))}">
        ${prevYearBrand.count > 0 ? formatGrowth(calculateGrowth(currentBrand.count, prevYearBrand.count)) : "N/A"}
        </div>
      </div>
    </div>
  `;
  
  return row;
}

function calculateAggregatedASPData(aspData) {
  const aggregated = {
    'Выкуп': { plan: 0, fact: 0, sum: 0 },
    'Trade-In': { plan: 0, fact: 0, sum: 0 },
    'Внутренний Trade-In': { plan: 0, fact: 0, sum: 0 },
    'Комиссия': { plan: 0, fact: 0, sum: 0 }
  };

  // Собираем данные по всем точкам
  for (const point in aspData) {
    for (const type in aspData[point]) {
      if (aggregated[type]) {
        // План берем только из первой точки (они одинаковые)
        if (aggregated[type].plan === 0) {
          aggregated[type].plan = aspData[point][type].plan || 0;
        }
        // Суммируем факт и сумму по всем точкам
        aggregated[type].fact += aspData[point][type].fact || 0;
        aggregated[type].sum += aspData[point][type].sum || 0;
      }
    }
  }

  return aggregated;
}

// Новая функция для создания карточки приема АСП
function createASPCard(point, aspData) {
  const card = document.createElement("div");
  card.className = "card asp-card";
  card.innerHTML = `
    <h2>Прием АСП - ${point}</h2>
    <div class="asp-stats-container"></div>
  `;
  
  const statsContainer = card.querySelector(".asp-stats-container");
  
  // Типы сделок в нужном порядке
  const dealTypes = ['Выкуп', 'Trade-In', 'Внутренний Trade-In', 'Комиссия'];
  
  dealTypes.forEach(type => {
    if (aspData[type]) {
      const typeData = aspData[type];
      const statElement = document.createElement("div");
      statElement.className = "asp-stat";
      statElement.innerHTML = `
        <h3>${type}</h3>
        <div class="asp-stat-grid">
          <div class="asp-stat-item">
            <span class="asp-stat-label">План</span>
            <span class="asp-stat-value">${typeData.plan} шт</span>
          </div>
          <div class="asp-stat-item">
            <span class="asp-stat-label">Факт</span>
            <span class="asp-stat-value">${typeData.fact} шт</span>
          </div>
          <div class="asp-stat-item">
            <span class="asp-stat-label">Отклонение</span>
            <span class="asp-stat-value ${getDeviationClass(typeData.deviation)}">
              ${formatDeviation(typeData.deviation)}
            </span>
          </div>
          <div class="asp-stat-item">
            <span class="asp-stat-label">Сумма</span>
            <span class="asp-stat-value">${formatNumber(typeData.sum)} ₽</span>
          </div>
          <div class="asp-stat-item">
            <span class="asp-stat-label">Средняя</span>
            <span class="asp-stat-value">${formatNumber(typeData.avgPrice)} ₽</span>
          </div>
        </div>
      `;
      statsContainer.appendChild(statElement);
    }
  });
  
  return card;
}

function updateServiceTab(data) {
  const container = document.getElementById("service-tab");
  if (!container) return;

  container.innerHTML = "";

  for (const point in data) {
    const pointData = data[point];
    if (pointData.nh.plan > 0 && pointData.gm1.plan > 0) {
    const card = document.createElement("div");
    card.className = "service-card";

    card.innerHTML = `
      <h3>${point}</h3>
      <div class="service-stats">
        <div class="service-stat">
          <div class="service-stat-label">Нормо-часы (план/факт)</div>
          <div class="service-stat-value">${formatNumber(pointData.nh.plan)} / ${formatNumber(pointData.nh.fact)}</div>
          <div class="service-stat-label">Отклонение</div>
          <div class="service-stat-value ${getDeviationClass(pointData.nh.deviation)}">
            ${formatDeviation(pointData.nh.deviation)}
          </div>
        </div>
        <div class="service-stat">
          <div class="service-stat-label">GM-1 (план/факт)</div>
          <div class="service-stat-value">${formatNumber(pointData.gm1.plan)} / ${formatNumber(pointData.gm1.fact)}</div>
          <div class="service-stat-label">Отклонение</div>
          <div class="service-stat-value ${getDeviationClass(pointData.gm1.deviation)}">
            ${formatDeviation(pointData.gm1.deviation)}
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  }
  }
}

function updateBalanceTab(data) {
  const container = document.getElementById("balance-tab");
  if (!container || !data) {
    container.innerHTML = "<div class='error-notification'>Данные баланса недоступны</div>";
    return;
  }

  container.innerHTML = "";

  // Проверяем структуру данных
  const balanceData = data.data || data;
  
  if (!balanceData.assets || !balanceData.liabilities) {
    container.innerHTML = "<div class='error-notification'>Неверный формат данных баланса</div>";
    return;
  }

  const cardsContainer = document.createElement("div");
  cardsContainer.className = "cards-container";
  container.appendChild(cardsContainer);

  const assetsCard = document.createElement("div");
  assetsCard.className = "card";
  assetsCard.innerHTML = `
    <h2>Активы</h2>
    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">Денежные средства:</span>
        <span>${formatNumber(data.assets.cash)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Складские остатки:</span>
        <span>${formatNumber(data.assets.warehouses)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Новые автомобили:</span>
        <span>${formatNumber(data.assets.newCars)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Автомобили с пробегом:</span>
        <span>${formatNumber(data.assets.usedCars)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Запчасти:</span>
        <span>${formatNumber(data.assets.parts)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Дебиторская задолженность:</span>
        <span>${formatNumber(data.assets.receivables)} руб.</span>
      </div>
      <div class="stat-row" style="margin-top: 15px; font-weight: 600;">
        <span class="stat-label">Итого активы:</span>
        <span>${formatNumber(data.assets.total)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(assetsCard);

  const liabilitiesCard = document.createElement("div");
  liabilitiesCard.className = "card";
  liabilitiesCard.innerHTML = `
    <h2>Пассивы</h2>
    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">Кредитные линии:</span>
        <span>${formatNumber(data.liabilities.vtb + data.liabilities.rnBank)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Факторинг:</span>
        <span>${formatNumber(data.liabilities.factoring)} руб.</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Прочие кредиты и займы:</span>
        <span>${formatNumber(data.liabilities.loan)} руб.</span>
      </div>
      <div class="stat-row" style="margin-top: 15px; font-weight: 600;">
        <span class="stat-label">Итого пассивы:</span>
        <span>${formatNumber(data.liabilities.total)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(liabilitiesCard);

  const netAssetsCard = document.createElement("div");
  netAssetsCard.className = "card net-assets-card";
  netAssetsCard.innerHTML = `
    <h2>Оперативные чистые активы</h2>
    <div class="stats" style="font-size: 18px;">
      <div class="stat-row" style="margin-top: 15px; font-weight: 600;">
        <span class="stat-label">Оперативные чистые активы (Активы - Пассивы):</span>
        <span class="net-assets-value">${formatNumber(data.netAssets)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(netAssetsCard);

}

function updateHeader() {
  const header = document.querySelector(".header h1");
  if (!header || !dashboardData) return;

  const activeTab = document.querySelector(".tab-btn.active");
  const tabName = activeTab ? activeTab.textContent.trim() : "Новые автомобили";
  const monthYear = dashboardData.currentMonth.replace(".", "/");

  header.textContent = `${tabName} - ${monthYear}`;
}

function refreshTabData(tabId) {
  if (!dashboardData) return;

  if (tabId === "new-cars-tab") {
    const processedData = processSalesData(
      dashboardData.newCars.currentData,
      dashboardData.newCars.prevData,
      dashboardData.newCars.prevYearData,
      dashboardData.newCars.plans
    );
    updateNewCarsTab(processedData);
  } else if (tabId === "used-cars-tab") {
    // 1. Обрабатываем данные продаж
    const processedData = processSalesData(
      dashboardData.usedCars.currentData,
      dashboardData.usedCars.prevData,
      dashboardData.usedCars.prevYearData,
      dashboardData.usedCars.plans
    );
    
    // 2. Добавляем ASP данные независимо от продаж
    if (dashboardData.usedCars.aspData) {
      processedData.aggregatedASPData = calculateAggregatedASPData(dashboardData.usedCars.aspData);
      
      // 3. Добавляем ASP данные для конкретных точек (если есть продажи)
      for (const point in dashboardData.usedCars.aspData) {
        if (processedData[point]) {
          processedData[point].aspData = dashboardData.usedCars.aspData[point];
        }
      }
    }
    
    updateUsedCarsTab(processedData);
  } else if (tabId === "service-tab") {
    updateServiceTab(dashboardData.serviceData);
  } else if (tabId === "mkc-tab") {
    updateMKCTab(dashboardData.mkcData);
  } else if (tabId === "balance-tab") {
    updateBalanceTab(dashboardData.balanceData);
  }
}

function getDefaultPlan(point, type) {
  const newCarPlans = {
    'Софийская': 120,
    'Руставели': 30,
    'Каширка': 3
  };
  
  const usedCarPlans = {
    'Софийская': 60,
    'Руставели': 15,
    'Каширка': 2
  };
  
  return type === 'new' 
    ? (newCarPlans[point] || 0)
    : (usedCarPlans[point] || 0);
}

function createLoadingIndicator() {
  const loader = document.createElement("div");
  loader.id = "loading-indicator";
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000000;
    color: white;
    font-size: 24px;
  `;
  loader.innerHTML = '<div class="spinner"></div><div>Загрузка данных...</div>';
  document.body.appendChild(loader);
}

function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-notification";
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function calculateDeviation(fact, plan) {
  if (plan === 0) return fact === 0 ? 0 : Infinity;
  return ((fact - plan) / plan) * 100;
}

function formatDeviation(value) {
  if (value === Infinity) return "+∞%";
  if (value === -Infinity) return "-∞%";
  if (isNaN(value)) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getDeviationClass(value) {
  if (value >= 0) return "positive";
  return "negative";
}

function calculateGrowth(current, previous) {
  if (previous === 0) return current === 0 ? 0 : Infinity;
  return ((current - previous) / previous) * 100;
}

function formatGrowth(value) {
  if (value === Infinity) return "+∞%";
  if (value === -Infinity) return "-∞%";
  if (isNaN(value)) {return "N/A";}

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getGrowthClass(value) {
  if (value === Infinity || value > 0) return "positive";
  if (value === -Infinity || value < 0) return "negative";
  return "neutral";
}

function formatNumber(num, decimals = 2) {
  if (typeof num !== "number") {
    num = parseFloat(num.toString().replace(/\s/g, "")) || 0;
  }
  const rounded = num.toFixed(decimals);
  const parts = rounded.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}
