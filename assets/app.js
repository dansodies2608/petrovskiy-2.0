const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwK_hEALq1EjnL2Sf2U71PFAqvJgvM4bI2QPREdGUcGqE2iZceZr1T13VtwnnDPPfo/exec";
const SECRET_KEY = "b3821cce5703d067b14f4e63c9e65fd86ce24f5de0438f8a69a006167f2899ca";

// Глобальные переменные
let dashboardData = null;
let currentTab = "new-cars-tab";

// Инициализация дашборда
document.addEventListener("DOMContentLoaded", function() {
  initDashboard();
});

function initDashboard() {
  createLoadingIndicator();
  showLoading(true);
  setupTabHandlers();
  setupDateSelector();
  loadData();
}

// Настройка обработчиков вкладок
function setupTabHandlers() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", function() {
      // Прокрутка вверх перед переключением
      window.scrollTo({ top: 0, behavior: "smooth" });
      
      // Обновление активной вкладки
      tabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      
      // Скрытие всех контентов и отображение нужного
      document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active");
      });
      
      currentTab = getTabId(this.dataset.count);
      document.getElementById(currentTab).classList.add("active");
      
      // Обновление данных, если они уже загружены
      if (dashboardData) {
        refreshTabData(currentTab);
      }
    });
  });
}

// Получение ID вкладки по номеру
function getTabId(count) {
  const tabs = {
    0: "new-cars-tab",
    1: "used-cars-tab",
    2: "service-tab",
    3: "mkc-tab",
    4: "balance-tab"
  };
  return tabs[count] || "new-cars-tab";
}

// Настройка селекторов даты
function setupDateSelector() {
  const monthSelect = document.getElementById('month-select');
  const yearSelect = document.getElementById('year-select');
  const applyBtn = document.getElementById('apply-date');
  
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  // Заполнение месяцев
  monthSelect.value = currentMonth;
  
  // Заполнение лет (текущее и 2 предыдущих)
  yearSelect.innerHTML = '';
  for (let year = currentYear - 2; year <= currentYear; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
  yearSelect.value = currentYear;
  
  // Обработчик кнопки применения
  applyBtn.addEventListener('click', () => {
    showLoading(true);
    loadData();
  });
}

// Загрузка данных с сервера
async function loadData() {
  try {
    const month = document.getElementById("month-select").value;
    const year = document.getElementById("year-select").value;
    
    // Проверка на будущую дату
    const today = new Date();
    if (year > today.getFullYear() || (year == today.getFullYear() && month > today.getMonth() + 1)) {
      showError("Нельзя выбрать будущую дату");
      return;
    }
    
    // Запрос всех данных одним вызовом
    const url = `${SCRIPT_URL}?key=${SECRET_KEY}&month=${month}&year=${year}&type=all`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
    
    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message);
    
    dashboardData = data;
    console.log(dashboardData)
    processAndDisplayData(data);
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    showError("Не удалось загрузить данные. Пожалуйста, попробуйте позже.");
  } finally {
    showLoading(false);
  }
}

// Обработка и отображение данных
function processAndDisplayData(data) {
  dashboardData = data;
  updateHeader();
  
  // Обновляем только активную вкладку
  refreshTabData(currentTab);
}

// Обновление данных на активной вкладке
function refreshTabData(tabId) {
  if (!dashboardData) return;
  
  switch (tabId) {
    case "new-cars-tab":
      updateNewCarsTab(dashboardData.newCars);
      break;
    case "used-cars-tab":
      updateUsedCarsTab(dashboardData.usedCars);
      break;
    case "service-tab":
      updateServiceTab(dashboardData.service);
      break;
    case "mkc-tab":
      updateMKCTab(dashboardData.mkc);
      break;
    case "balance-tab":
      updateBalanceTab(dashboardData.balance);
      break;
  }
}

// Обновление вкладки с новыми автомобилями (НА)
function updateNewCarsTab(data) {
  const container = document.querySelector("#new-cars-tab .cards-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Создаем карточки для каждой точки продаж
  for (const point in data.currentData) {
    const card = createSalesCard(point, data, "new");
    container.appendChild(card);
  }
}

// Обновление вкладки с автомобилями с пробегом (АСП)
function updateUsedCarsTab(data) {
  const container = document.querySelector("#used-cars-tab .cards-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  // 1. Карточки по точкам продаж
  for (const point in data.currentData) {
    const card = createSalesCard(point, data, "used");
    container.appendChild(card);
  }
  
  // 2. Сводка по приему АСП
  if (data.aspData) {
    const summaryCard = createASPSummaryCard(data.aspData);
    container.appendChild(summaryCard);
  }
}

// Создание карточки продаж
function createSalesCard(point, data, type) {
  const { currentData, prevMonthData, prevYearData, plans } = data;
  const current = currentData[point] || { total: 0, jok: 0, brands: {} };
  const prevMonth = prevMonthData[point] || { total: 0, brands: {} };
  const prevYear = prevYearData[point] || { total: 0, brands: {} };
  const plan = plans[point] || { total: 0 };
  
  const deviation = calculateDeviation(current.total, plan.total);
  const growthMonth = calculateGrowth(current.total, prevMonth.total);
  const growthYear = calculateGrowth(current.total, prevYear.total);
  
  const card = document.createElement("div");
  card.className = "card";
  
  card.innerHTML = `
    <h2>${point}</h2>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">План</span>
        <span class="stat-value">${plan.total} шт</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Факт</span>
        <span class="stat-value">${current.total} шт</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Откл.</span>
        <span class="stat-value ${getDeviationClass(deviation)}">
          ${formatDeviation(deviation)}
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
        ${type === "new" ? '<button class="toggle-brands">+</button>' : ''}
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
          <div class="brand-value">${prevMonth.total}</div>
          <div class="brand-value">${prevYear.total > 0 ? prevYear.total : "N/A"}</div>
        </div>
        <div class="growth-column">
          <div class="growth-header">Рост</div>
          <div class="growth-value"></div>
          <div class="growth-value ${getGrowthClass(growthMonth)}">
            ${formatGrowth(growthMonth)}
          </div>
          <div class="growth-value ${getGrowthClass(growthYear)}">
            ${prevYear.total > 0 ? formatGrowth(growthYear) : "N/A"}
          </div>
        </div>
      </div>
      <div class="brands-container"></div>
    </div>
  `;
  
  // Обработчик для кнопки показа брендов (только для НА)
  if (type === "new") {
    const toggleBtn = card.querySelector('.toggle-brands');
    const brandsContainer = card.querySelector('.brands-container');
    
    toggleBtn.addEventListener('click', function() {
      const isExpanded = brandsContainer.classList.contains('expanded');
      
      if (isExpanded) {
        brandsContainer.classList.remove('expanded');
        toggleBtn.textContent = '+';
      } else {
        // Создаем строки для каждого бренда
        brandsContainer.innerHTML = '';
        const allBrands = getAllBrands(current.brands, prevMonth.brands, prevYear.brands);
        
        allBrands.forEach(brand => {
          const brandRow = createBrandRow(
            brand, 
            current.brands[brand] || { count: 0 },
            prevMonth.brands[brand] || { count: 0 },
            prevYear.brands[brand] || { count: 0 }
          );
          brandsContainer.appendChild(brandRow);
        });
        
        brandsContainer.classList.add('expanded');
        toggleBtn.textContent = '-';
      }
    });
  }
  
  return card;
}

// Создание сводной карточки по приему АСП
function createASPSummaryCard(aspData) {
  // Агрегируем данные по всем точкам
  const aggregated = {
    'Выкуп': { plan: 0, fact: 0, sum: 0 },
    'Trade-In': { plan: 0, fact: 0, sum: 0 },
    'Внутренний Trade-In': { plan: 0, fact: 0, sum: 0 },
    'Комиссия': { plan: 0, fact: 0, sum: 0 }
  };
  
  // Суммируем данные по всем точкам
  for (const point in aspData) {
    for (const type in aspData[point]) {
      if (aggregated[type]) {
        // План берем только из первой точки (они одинаковые)
        if (aggregated[type].plan === 0) {
          aggregated[type].plan = aspData[point][type].plan || 0;
        }
        aggregated[type].fact += aspData[point][type].fact || 0;
        aggregated[type].sum += aspData[point][type].sum || 0;
      }
    }
  }
  
  // Создаем карточку
  const card = document.createElement("div");
  card.className = "card asp-summary-card";
  card.innerHTML = `
    <h2>Сводные данные по приему АСП</h2>
    <div class="asp-summary-container"></div>
  `;
  
  const container = card.querySelector(".asp-summary-container");
  
  // Добавляем данные по каждому типу сделки
  ['Выкуп', 'Trade-In', 'Внутренний Trade-In', 'Комиссия'].forEach(type => {
    if (aggregated[type].plan > 0 || aggregated[type].fact > 0) {
      const typeData = aggregated[type];
      const deviation = calculateDeviation(typeData.fact, typeData.plan);
      const avgPrice = typeData.fact > 0 ? typeData.sum / typeData.fact : 0;
      
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
      container.appendChild(statElement);
    }
  });
  
  return card;
}

// Обновление вкладки СТО
function updateServiceTab(data) {
  const container = document.getElementById("service-tab");
  if (!container) return;
  
  container.innerHTML = "";
  
  for (const point in data) {
    const pointData = data[point];
    if (pointData.nh.plan > 0 || pointData.nh.fact > 0) {
      const card = createServiceCard(point, pointData);
      container.appendChild(card);
    }
  }
}

// Создание карточки СТО
function createServiceCard(point, data) {
  const card = document.createElement("div");
  card.className = "service-card";
  
  card.innerHTML = `
    <h3>${point}</h3>
    <div class="service-stats">
      <div class="service-stat">
        <div class="service-stat-label">Нормо-часы (план/факт)</div>
        <div class="service-stat-value">${formatNumber(data.nh.plan)} / ${formatNumber(data.nh.fact)}</div>
        <div class="service-stat-label">Отклонение</div>
        <div class="service-stat-value ${getDeviationClass(data.nh.deviation)}">
          ${formatDeviation(data.nh.deviation)}
        </div>
      </div>
      <div class="service-stat">
        <div class="service-stat-label">GM-1 (план/факт)</div>
        <div class="service-stat-value">${formatNumber(data.gm1.plan)} / ${formatNumber(data.gm1.fact)}</div>
        <div class="service-stat-label">Отклонение</div>
        <div class="service-stat-value ${getDeviationClass(data.gm1.deviation)}">
          ${formatDeviation(data.gm1.deviation)}
        </div>
      </div>
    </div>
  `;
  
  return card;
}

// Обновление вкладки МКЦ (аналогично СТО)
function updateMKCTab(data) {
  const container = document.getElementById("mkc-tab");
  if (!container) return;
  
  container.innerHTML = "";
  
  for (const point in data) {
    const pointData = data[point];
    if (pointData.nh.plan > 0 || pointData.nh.fact > 0) {
      const card = createServiceCard(point, pointData);
      container.appendChild(card);
    }
  }
}

// Обновление вкладки баланса
function updateBalanceTab(data) {
  const container = document.getElementById("balance-tab");
  if (!container) return;
  
  container.innerHTML = "";
  
  const cardsContainer = document.createElement("div");
  cardsContainer.className = "cards-container";
  container.appendChild(cardsContainer);
  
  // Карточка активов
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
      <div class="stat-row total-row">
        <span class="stat-label">Итого активы:</span>
        <span>${formatNumber(data.assets.total)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(assetsCard);
  
  // Карточка пассивов
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
      <div class="stat-row total-row">
        <span class="stat-label">Итого пассивы:</span>
        <span>${formatNumber(data.liabilities.total)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(liabilitiesCard);
  
  // Карточка чистых активов
  const netAssetsCard = document.createElement("div");
  netAssetsCard.className = "card net-assets-card";
  netAssetsCard.innerHTML = `
    <h2>Оперативные чистые активы</h2>
    <div class="stats">
      <div class="stat-row total-row">
        <span class="stat-label">Оперативные чистые активы (Активы - Пассивы):</span>
        <span class="net-assets-value">${formatNumber(data.netAssets)} руб.</span>
      </div>
    </div>
  `;
  cardsContainer.appendChild(netAssetsCard);
}

// Вспомогательные функции

function updateHeader() {
  const header = document.querySelector(".header h1");
  if (!header || !dashboardData) return;

  const activeTab = document.querySelector(".tab-btn.active");
  const tabName = activeTab ? activeTab.textContent.trim() : "Новые автомобили";
  const monthYear = dashboardData.currentMonth.replace(".", "/");

  header.textContent = `${tabName} - ${monthYear}`;
}

function getAllBrands(...brandsData) {
  const allBrands = new Set();
  
  brandsData.forEach(data => {
    for (const brand in data) {
      allBrands.add(brand);
    }
  });
  
  return Array.from(allBrands).sort();
}

function createBrandRow(brand, current, prevMonth, prevYear) {
  const growthMonth = calculateGrowth(current.count, prevMonth.count);
  const growthYear = calculateGrowth(current.count, prevYear.count);
  
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
        <div class="brand-value">${current.count}</div>
        <div class="brand-value">${prevMonth.count}</div>
        <div class="brand-value">${prevYear.count > 0 ? prevYear.count : "N/A"}</div>
      </div>
      <div class="growth-column">
        <div class="growth-header">Рост</div>
        <div class="growth-value"></div>
        <div class="growth-value ${getGrowthClass(growthMonth)}">
          ${formatGrowth(growthMonth)}
        </div>
        <div class="growth-value ${getGrowthClass(growthYear)}">
          ${prevYear.count > 0 ? formatGrowth(growthYear) : "N/A"}
        </div>
      </div>
    </div>
  `;
  
  return row;
}

function calculateDeviation(fact, plan) {
  if (plan === 0) return 0;
  return ((fact - plan) / plan) * 100;
}

function formatDeviation(value) {
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
  if (isNaN(value)) return "N/A";
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
    z-index: 1000;
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
