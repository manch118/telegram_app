/* eslint-disable */
const API_URL = "https://5370-87-241-180-199.ngrok-free.app";
let cart = [];
let filteredProducts = [];
let priceRange = [0, 3000000];

const userId = Telegram.WebApp.initDataUnsafe.user?.id.toString() || "test_user";
const userName = Telegram.WebApp.initDataUnsafe.user?.username ? `@${Telegram.WebApp.initDataUnsafe.user.username}` : Telegram.WebApp.initDataUnsafe.user?.first_name || "Неизвестный пользователь";

function updateTheme() {
  const theme = Telegram.WebApp.themeParams;
  document.documentElement.style.setProperty('--tg-theme-bg', theme.bg_color || '#ffffff');
  document.documentElement.style.setProperty('--tg-theme-text', theme.text_color || '#000000');
  document.documentElement.style.setProperty('--tg-theme-button', theme.button_color || '#00FF88');
  document.documentElement.style.setProperty('--tg-theme-button-text', theme.button_text_color || '#000000');
}
Telegram.WebApp.onEvent('themeChanged', updateTheme);
updateTheme();

async function fetchProducts(force = false) {
  try {
    const url = `${API_URL}/products/${force ? '?t=' + Date.now() : ''}`;
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch products: ${errorText}`);
    }
    filteredProducts = await response.json();
    console.log('Fetched products:', filteredProducts);
    renderProducts();
  } catch (error) {
    console.error('Fetch products error:', error);
    showCustomAlert(`Ошибка загрузки товаров: ${error.message}`);
  }
}

async function fetchCart() {
  try {
    const response = await fetch(`${API_URL}/cart/${userId}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error('Failed to fetch cart');
    cart = await response.json();
    renderCart();
  } catch (error) {
    console.error('Fetch cart error:', error);
    showCustomAlert(`Ошибка загрузки корзины: ${error.message}`);
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = filteredProducts
    .filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])
    .map(product => `
      <div class="product-card" id="product-${product.id}">
        <img src="${product.img}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p>${product.price} ₽</p>
        <button class="add-btn" onclick="addToCart(${product.id})">Добавить</button>
      </div>
    `).join('');
  if (grid.innerHTML === '') {
    grid.innerHTML = '<p>Нет товаров для отображения</p>';
  }
}

async function addToCart(productId) {
  try {
    const response = await fetch(`${API_URL}/cart/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ product_id: productId, quantity: 1, user_id: userId })
    });
    if (response.ok) {
      const card = document.getElementById(`product-${productId}`);
      card.classList.add('fly-to-cart');
      setTimeout(() => card.classList.remove('fly-to-cart'), 500);
      showCustomAlert('Товар добавлен в корзину');
      await fetchCart();
      openCart();
      document.getElementById('cartSidebar').scrollIntoView({ behavior: 'smooth' });
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to add to cart');
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    showCustomAlert(`Ошибка: ${error.message}`);
  }
}
//verji komerot 
document.addEventListener("DOMContentLoaded", function () {
  const scrollBtn = document.getElementById("scrollUpBtn");

  // Скрываем кнопку по умолчанию
  scrollBtn.style.display = "none";

  // Показываем кнопку при скролле вниз
  window.addEventListener("scroll", function () {
    if (window.scrollY > 100) {
      scrollBtn.style.display = "flex";
    } else {
      scrollBtn.style.display = "none";
    }
  });

  // Плавный скролл наверх
  scrollBtn.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
});
 

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.querySelector('.scroll-to-top');
    btn.addEventListener('click', scrollToTop);
});


function renderCart() {
  const cartItems = document.getElementById('cartItems');
  if (!cartItems) return;
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${item.product.img}" alt="${item.product.name}">
        <span>${item.product.name} (${item.product.price} ₽)</span>
      </div>
      <div class="quantity">
        <button onclick="updateQuantity(${item.id}, -1)">-</button>
        <span>${item.quantity}</span>
        <button onclick="updateQuantity(${item.id}, 1)">+</button>
      </div>
    </div>
  `).join('');
  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  cartItems.innerHTML += `<p>Итого: ${total} ₽</p>`;
  document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.quantity, 0) || 0;
}

async function updateQuantity(cartItemId, change) {
  try {
    const cartItem = cart.find(item => item.id === cartItemId);
    if (!cartItem) {
      showCustomAlert('Товар не найден в корзине');
      return;
    }
    const newQuantity = cartItem.quantity + change;
    let response;
    if (newQuantity <= 0) {
      response = await fetch(`${API_URL}/cart/${cartItemId}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache' }
      });
    } else {
      response = await fetch(`${API_URL}/cart/${cartItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ quantity: newQuantity })
      });
    }
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error ${response.status}`);
    }
    await fetchCart();
    showCustomAlert(`Количество обновлено: ${newQuantity}`);
  } catch (error) {
    console.error('Error updating quantity:', error);
    showCustomAlert(`Ошибка обновления количества: ${error.message}`);
  }
}

async function clearCart() {
  try {
    const response = await fetch(`${API_URL}/cart/${userId}`, {
      method: 'DELETE',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to clear cart');
    }
    await fetchCart();
    showCustomAlert('Корзина очищена');
  } catch (error) {
    console.error('Clear cart error:', error);
    showCustomAlert(`Ошибка очистки корзины: ${error.message}`);
  }
}

async function searchProducts(query) {
  try {
    const response = await fetch(`${API_URL}/products/filter/?query=${encodeURIComponent(query)}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to search products');
    filteredProducts = await response.json();
    renderProducts();
  } catch (error) {
    console.error('Search error:', error);
    showCustomAlert(`Ошибка поиска: ${error.message}`);
  }
}

async function filterCategory(category) {
  document.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
  const target = event.currentTarget || document.querySelector(`.category[onclick="filterCategory('${category}')"]`);
  target.classList.add('active');
  try {
    const queryParams = new URLSearchParams({
      category: category,
      min_price: priceRange[0],
      max_price: priceRange[1]
    });
    const searchInput = document.querySelector('.search-bar input').value;
    if (searchInput) queryParams.append('query', searchInput);
    const response = await fetch(`${API_URL}/products/filter/?${queryParams.toString()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to filter products');
    filteredProducts = await response.json();
    renderProducts();
  } catch (error) {
    console.error('Filter error:', error);
    showCustomAlert(`Ошибка фильтрации: ${error.message}`);
  }
}

async function showFilters() {
  try {
    const popup = document.getElementById('filterPopup');
    document.getElementById('priceRangeDisplay').textContent = `${priceRange[0]} ₽ - ${priceRange[1]} ₽`;
    popup.style.display = 'flex';
  } catch (error) {
    console.error('showFilters error:', error);
    showCustomAlert(`Ошибка открытия фильтров: ${error.message}`);
  }
}

function closeFilterPopup() {
  document.getElementById('filterPopup').style.display = 'none';
}

async function selectFilter(buttonId) {
  const currentCategory = document.querySelector('.category.active')?.textContent.toLowerCase() || 'all';
  const searchInput = document.querySelector('.search-bar input').value;
  if (buttonId === 'price') {
    const maxPrice = prompt(`Введите максимальную цену (текущая: ${priceRange[1]} ₽)`, priceRange[1]);
    if (maxPrice) {
      priceRange = [0, parseInt(maxPrice) || 100000];
      try {
        const queryParams = new URLSearchParams({
          category: currentCategory,
          min_price: priceRange[0],
          max_price: priceRange[1]
        });
        if (searchInput) queryParams.append('query', searchInput);
        const response = await fetch(`${API_URL}/products/filter/?${queryParams.toString()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) throw new Error('Failed to apply price filter');
        filteredProducts = await response.json();
        renderProducts();
      } catch (error) {
        console.error('Price filter error:', error);
        showCustomAlert(`Ошибка фильтрации: ${error.message}`);
      }
    }
  } else if (buttonId === 'new') {
    try {
      const queryParams = new URLSearchParams({
        category: currentCategory,
        min_price: priceRange[0],
        max_price: priceRange[1]
      });
      if (searchInput) queryParams.append('query', searchInput);
      const response = await fetch(`${API_URL}/products/filter/?${queryParams.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      filteredProducts = (await response.json()).reverse();
      renderProducts();
    } catch (error) {
      console.error('Sort error:', error);
      showCustomAlert(`Ошибка сортировки: ${error.message}`);
    }
  } else if (buttonId === 'popular') {
    try {
      const queryParams = new URLSearchParams({
        category: currentCategory,
        min_price: priceRange[0],
        max_price: priceRange[1]
      });
      if (searchInput) queryParams.append('query', searchInput);
      const response = await fetch(`${API_URL}/products/filter/?${queryParams.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      filteredProducts = (await response.json()).sort((a, b) => b.price - a.price);
      renderProducts();
    } catch (error) {
      console.error('Sort error:', error);
      showCustomAlert(`Ошибка сортировки: ${error.message}`);
    }
  } else if (buttonId === 'reset') {
    priceRange = [0, 100000];
    document.querySelector('.search-bar input').value = '';
    document.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
    document.querySelector('.category').classList.add('active');
    try {
      const response = await fetch(`${API_URL}/products/`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      filteredProducts = await response.json();
      renderProducts();
    } catch (error) {
      console.error('Reset error:', error);
      showCustomAlert(`Ошибка сброса фильтров: ${error.message}`);
    }
  }
  closeFilterPopup();
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ для открытия формы заказа
function openCheckoutPopup() {
    if (cart.length === 0) {
        showCustomAlert('Корзина пуста!');
        return;
    }
    const popup = document.getElementById('checkoutPopup');
    if (!popup) {
        console.error('Элемент checkoutPopup не найден!');
        showCustomAlert('Ошибка открытия формы заказа');
        return;
    }
    closeCart();
    closeMenu();
    popup.classList.add('show');
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.onClick(closeCheckoutPopup);
    }
    setTimeout(() => {
        popup.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ для закрытия формы заказа
function closeCheckoutPopup() {
    const popup = document.getElementById('checkoutPopup');
    if (popup) {
        popup.classList.remove('show');
    }
    document.body.style.overflow = ''; // Восстанавливаем прокрутку
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.BackButton.hide();
    }
}

async function checkout(event) {
    event.preventDefault();
    const submitButton = document.querySelector('#checkoutForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Отправка...';

    const form = document.getElementById('checkoutForm');
    const formData = new FormData(form);
    const phone = formData.get('phone');
    const address = formData.get('address');
    const delivery_method = formData.get('delivery_method');
    const payment_method = formData.get('payment_method');
    
           // Проверяем, что корзина не пуста
        if (cart.length === 0) {
        showCustomAlert("Ваша корзина пуста! Добавьте товары перед оплатой.");
        return;
    }

      // Проверяем, что Stripe загружен
    if (!window.stripe) {
        showCustomAlert("Ошибка: платежная система не загружена. Попробуйте позже.");
        return;
    }

    if (!phone || !address || !delivery_method || !payment_method) {
        showCustomAlert('Пожалуйста, заполните все поля формы!');
        submitButton.disabled = false;
        submitButton.textContent = 'Подтвердить заказ';
        return;
    }

    const orderData = {
        user_id: userId,
        phone,
        address,
        delivery_method,
        payment_method,
        total: cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
        items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }))
    };
    try {
        const response = await fetch(`${API_URL}/checkout/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Ошибка оформления заказа (код ${response.status})`);
        }

        const result = await response.json();
        if (result.payment_required && payment_method === 'Карта') {
            if (!window.stripe) {
                throw new Error("Stripe не инициализирован!");
            }
            await initiateCardPayment(result.order_id, result.total); // Теперь функция доступна
        } else {
            showCustomAlert(`Заказ оформлен!\nНомер заказа: ${result.order_id}\nСумма: ${result.total} ₽`);
            await fetchCart();
            closeCheckoutPopup();
        }
    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        showCustomAlert(`Ошибка: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Подтвердить заказ';
    }
}
async function initiatePayment() {
    if (cart.length === 0) {
        showCustomAlert('Корзина пуста!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create-invoice/${userId}`, {
            method: 'POST',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create invoice');
        }
        const { result: invoiceLink } = await response.json();

        Telegram.WebApp.openInvoice(invoiceLink, async (status) => {
            if (status === 'paid') {
                // После успешной оплаты создаем заказ
                const form = document.getElementById('checkoutForm');
                const formData = new FormData(form);
                const orderData = {
                    user_id: userId,
                    phone: formData.get('phone') || Telegram.WebApp.initDataUnsafe.user?.phone_number || '',
                    address: formData.get('address') || '',
                    delivery_method: formData.get('delivery_method') || 'Курьер',
                    payment_method: 'Telegram Payments',
                    total: cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
                    items: cart.map(item => ({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        price: item.product.price
                    }))
                };

                try {
                    const orderResponse = await fetch(`${API_URL}/checkout/${userId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                        body: JSON.stringify(orderData)
                    });
                    if (!orderResponse.ok) {
                        const error = await orderResponse.json();
                        throw new Error(error.detail || 'Failed to create order');
                    }
                    const result = await orderResponse.json();
                    await fetchCart(); // Обновляем корзину
                    showCustomAlert(`Оплата прошла успешно!\nНомер заказа: ${result.order_id}\nСумма: ${result.total} ₽`);
                    closeCheckoutPopup();
                } catch (orderError) {
                    console.error('Order creation error:', orderError);
                    showCustomAlert(`Ошибка оформления заказа после оплаты: ${orderError.message}`);
                }
            } else if (status === 'cancelled') {
                showCustomAlert('Оплата была отменена.');
            } else {
                showCustomAlert(`Ошибка оплаты: ${status}`);
            }
        });
    } catch (error) {
        console.error('Payment error:', error);
        showCustomAlert(`Ошибка оплаты: ${error.message}`);
    }
}

function openCart() {
  document.getElementById('cartSidebar').classList.add('open');
}

function closeCart() {
  document.getElementById('cartSidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMenu() {
  document.getElementById('menuSidebar').classList.add('open');
}

function closeMenu() {
  document.getElementById('menuSidebar').classList.remove('open');
}

// УЛУЧШЕННАЯ функция показа уведомлений для Telegram
function showCustomAlert(message) {
  // Сначала пробуем использовать нативные уведомления Telegram
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
    try {
      Telegram.WebApp.showAlert(message);
      return;
    } catch (e) {
      console.log('Telegram alert не работает, используем кастомный');
    }
  }
  
  // Fallback на кастомное уведомление
  const popup = document.createElement('div');
  popup.className = 'tg-alert-overlay';
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  popup.innerHTML = `
    <div class="tg-alert-container" style="
      background: white;
      padding: 20px;
      border-radius: 10px;
      max-width: 300px;
      margin: 20px;
      text-align: center;
    ">
      <div class="tg-alert-title" style="font-weight: bold; margin-bottom: 10px;">Уведомление</div>
      <div class="tg-alert-message" style="margin-bottom: 20px;">${message}</div>
      <div class="tg-alert-buttons">
        <button class="tg-alert-button tg-alert-button-ok" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        " onclick="this.closest('.tg-alert-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
}

function showDeliveryInfo() {
  showCustomAlert('Доставка по России:\n- Курьером: от 300 ₽, 1-3 дня\n- Почтой: от 200 ₽, 3-7 дней\n- Самовывоз: бесплатно\nВыберите способ при оформлении.');
  closeMenu();
}

function showPaymentInfo() {
  showCustomAlert('Принимаем:\n- Банковские карты (Visa, MasterCard)\n- Telegram Payments\n- Наличные при получении\nОплата после подтверждения заказа.');
  closeMenu();
}

function showAboutInfo() {
  showCustomAlert('mshops — ваш надёжный магазин электроники и одежды. Мы работаем с 2023 года, предлагая качественные товары по доступным ценам.');
  closeMenu();
}

function showReviews() {
  showCustomAlert('⭐⭐⭐⭐⭐ Иван: "Отличный магазин, быстрая доставка!"\n⭐⭐⭐⭐ Анна: "Качественные товары, рекомендую!"');
  closeMenu();
}

function showContactInfo() {
  showCustomAlert('Свяжитесь с нами:\n- Email: support@mshops.ru\n- Telegram: @ShopManchBot\n- Телефон: +7 (999) 123-45-67');
  closeMenu();
}

async function showMyOrders() {
  try {
    const userId = Telegram.WebApp.initDataUnsafe.user?.id.toString() || "test_user";
    const response = await fetch(`${API_URL}/orders/${userId}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Не удалось загрузить заказы (код ${response.status})`);
    }
    
    const orders = await response.json();
    console.log('Полученные заказы:', JSON.stringify(orders, null, 2));
    
    if (orders.length === 0) {
      showCustomAlert('Ваши заказы:\n- Пока заказов нет. Сделайте первый заказ!');
    } else {
      // Сортируем заказы по дате (от новых к старым) и берём последний
      const latestOrder = orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0];
      
      const itemsText = (latestOrder.items && Array.isArray(latestOrder.items) && latestOrder.items.length > 0)
        ? latestOrder.items.map(item => 
            `• ${item.product_name || `Товар ID ${item.product_id}`} (x${item.quantity}) - ${item.price} ₽`
          ).join('\n')
        : 'Нет товаров в заказе';
      
      const orderText = 
        `Последний заказ #${latestOrder.id} от ${new Date(latestOrder.order_date).toLocaleString('ru-RU')}:\n` +
        `${itemsText}\n` +
        `Итого: ${latestOrder.total} ₽\n` +
        `Статус: ${latestOrder.status}\n` +
        `Адрес: ${latestOrder.address}\n` +
        `Способ доставки: ${latestOrder.delivery_method}\n` +
        `Способ оплаты: ${latestOrder.payment_method}`;
      
      showCustomAlert(orderText);
    }
    
    closeMenu();
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error);
    showCustomAlert(`Ошибка: ${error.message}`);
    closeMenu();
  }
}

function showChannel() {
  Telegram.WebApp.openLink('https://t.me/ShopManchBot');
  closeMenu();
}

function bannerClick() {
  showCustomAlert('Скидка 20% на наушники! Добавляем в корзину?');
  addToCart(3);
}

function showPremiumProduct() {
  document.getElementById("premiumPopup").style.display = "flex";
}

function closePremiumPopup() {
  document.getElementById("premiumPopup").style.display = "none";
}

function confirmAddPremium() {
    const productId = document.getElementById('premiumPopup').getAttribute('data-product-id');
    const userId = Telegram.WebApp.initDataUnsafe.user?.id.toString() || "test_user";
    const quantity = 1;

    fetch('https://5370-87-241-180-199.ngrok-free.app/cart/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
            product_id: parseInt(productId),
            user_id: userId,
            quantity: quantity
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(error => {
                throw new Error(error.detail || `Ошибка HTTP ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        showCustomAlert("Товар добавлен в корзину!");
        closePremiumPopup();
        fetchCart(); // Обновляем корзину
    })
    .catch(error => {
        showCustomAlert(`Ошибка при добавлении товара: ${error.message}`);
        console.error('Add to cart error:', error);
    });
}

async function showAdminPanel() {
  try {
    const response = await fetch(`${API_URL}/check-admin/${userId}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) {
      throw new Error(`Ошибка проверки прав: ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.is_admin) {
      showCustomAlert('Доступно только для администраторов');
      return;
    }
    const productsResponse = await fetch(`${API_URL}/products/`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!productsResponse.ok) {
      throw new Error(`Не удалось загрузить товары: ${await productsResponse.text()}`);
    }
    const products = await productsResponse.json();
    const productList = document.getElementById('adminProductList');
    productList.innerHTML = products.map(product => `
      <div class="product-item">
        <span>${product.name} (${product.price} ₽)</span>
        <button onclick="deleteProduct(${product.id})">Удалить</button>
      </div>
    `).join('');
    document.getElementById('adminPanelPopup').style.display = 'flex';
    closeMenu();
  } catch (error) {
    console.error('Admin panel error:', error);
    showCustomAlert(`Ошибка: ${error.message}`);
  }
}

function closeAdminPanel() {
  document.getElementById('adminPanelPopup').style.display = 'none';
}

  function showAddProductForm() {
  const adminPanel = document.getElementById('adminPanelPopup');
  const addProductPopup = document.getElementById('addProductPopup');
  
  if (adminPanel && addProductPopup) {
    adminPanel.style.display = 'none'; // Скрываем админ-панель
    addProductPopup.style.display = 'flex'; // Показываем форму
    addProductPopup.classList.add('show'); // Активируем анимацию
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
    
    // Прокручиваем к форме с центрированием
    setTimeout(() => {
      addProductPopup.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    // Показываем кнопку "Назад" в Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      Telegram.WebApp.BackButton.show();
      Telegram.WebApp.BackButton.onClick(closeAddProductPopup);
    }
  }
}

function closeAddProductPopup() {
  const addProductPopup = document.getElementById('addProductPopup');
  if (addProductPopup) {
    addProductPopup.classList.remove('show');
    setTimeout(() => {
      addProductPopup.style.display = 'none'; // Скрываем после анимации
      document.getElementById('addProductForm').reset();
      const preview = document.getElementById('imagePreview');
      if (preview) preview.style.display = 'none';
      document.body.style.overflow = ''; // Восстанавливаем прокрутку
    }, 300); // Ждём завершения анимации (0.3s)
    
    // Скрываем кнопку "Назад" в Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      Telegram.WebApp.BackButton.hide();
    }
  }
}

function previewImage(event) {
  const preview = document.getElementById('imagePreview');
  preview.src = URL.createObjectURL(event.target.files[0]);
  preview.style.display = 'block';
}

// Перед вызовом оплаты
async function checkCartBeforePayment(userId) {
  const response = await fetch(`/cart/${userId}`);
  const cart = await response.json();
  if (!cart || cart.length === 0) {
    throw new Error('Ваша корзина пуста!');
  }
  return cart;
}

async function addProduct(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const imageFile = formData.get('img');
    let imageUrl = 'default.jpg';
    if (imageFile && imageFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append('file', imageFile);
      const uploadResponse = await fetch(`${API_URL}/upload-image`, {
        method: 'POST',
        body: uploadData
      });
      if (!uploadResponse.ok) throw new Error('Ошибка загрузки изображения');
      const uploadResult = await uploadResponse.json();
      imageUrl = uploadResult.file_path;
    }

    const productData = {
      name: formData.get('name'),
      price: parseFloat(formData.get('price')),
      img: imageUrl,
      category: formData.get('category')
    };

    const response = await fetch(`${API_URL}/products/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка сервера');
    }

    showCustomAlert('Товар успешно добавлен!');
    form.reset();
    closeAddProductPopup();
    await fetchProducts(true);
  } catch (error) {
    console.error('Add product error:', error);
    showCustomAlert(`Ошибка: ${error.message}`);
  }
}

async function deleteProduct(productId) {
  try {
    const response = await fetch(`${API_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось удалить товар');
    }
    showCustomAlert('Товар успешно удален!');
    await fetchProducts();
  } catch (error) {
    console.error('Delete product error:', error);
    showCustomAlert(`Ошибка удаления товара: ${error.message}`);
  }
}

const banners = document.querySelectorAll('.banner img');
let currentBanner = 0;
function rotateBanners() {
  banners[currentBanner].classList.add('hidden');
  currentBanner = (currentBanner + 1) % banners.length;
  banners[currentBanner].classList.remove('hidden');
}
setInterval(rotateBanners, 5000);

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  const addProductForm = document.getElementById('addProductForm');
  const checkoutForm = document.getElementById('checkoutForm');
  
  if (addProductForm) {
    addProductForm.addEventListener('submit', addProduct);
  }
  
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', checkout);
  }
});

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
  
  // Включаем кнопку закрытия для всех popup-ов
  Telegram.WebApp.enableClosingConfirmation();
}

// Функция для обработки параметров URL после оплаты
function handlePaymentRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntent = urlParams.get('payment_intent');
    const redirectStatus = urlParams.get('redirect_status');
    const orderId = localStorage.getItem('currentOrderId'); // Сохраняем orderId перед оплатой

    if (paymentIntent && redirectStatus === 'succeeded' && orderId) {
        console.log('Обработка успешной оплаты:', paymentIntent, orderId);
        // Очищаем параметры URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Вызываем /payment-success
        fetch(`${API_URL}/payment-success`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({
                payment_intent: paymentIntent,
                user_id: userId,
                order_id: orderId
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(error => {
                    throw new Error(error.detail || `Ошибка HTTP ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Подтверждение оплаты:', data);
            showCustomAlert(`Оплата прошла успешно! Заказ #${data.order_id} оплачен.`);
            fetchCart(); // Обновляем корзину
            closeCheckoutPopup();
            localStorage.removeItem('currentOrderId'); // Очищаем orderId
        })
        .catch(error => {
            console.error('Ошибка подтверждения оплаты:', error);
            showCustomAlert(`Ошибка подтверждения оплаты: ${error.message}`);
        });
    }
}

// Обновлённая функция initiateCardPayment
async function initiateCardPayment(orderId, total) {
    if (cart.length === 0) {
        showCustomAlert('Корзина пуста!');
        return;
    }

    try {
        console.log('Создание PaymentIntent для заказа:', orderId, 'Сумма:', total);
        const response = await fetch(`${API_URL}/create-payment-intent/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ amount: total })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `HTTP ошибка ${response.status}`);
        }
        const { client_secret, payment_intent_id } = await response.json();
        console.log('client_secret:', client_secret, 'payment_intent_id:', payment_intent_id);

        // Сохраняем orderId перед оплатой
        localStorage.setItem('currentOrderId', orderId);

        const appearance = {
            theme: 'stripe',
            variables: {
                colorPrimary: '#0570de',
                colorBackground: '#ffffff',
                colorText: '#30313d',
                borderRadius: '8px'
            }
        };

        const elements = stripe.elements({ clientSecret: client_secret, appearance });
        const paymentElement = elements.create('payment');
        
        const paymentPopup = document.createElement('div');
        paymentPopup.className = 'payment-popup';
        paymentPopup.innerHTML = `
            <div class="payment-popup-content">
                <button class="close-btn" onclick="this.closest('.payment-popup').remove(); Telegram.WebApp.BackButton.hide();">✖</button>
                <h2>Оплата заказа #${orderId}</h2>
                <div id="payment-element"></div>
                <button id="submit-payment">Оплатить ${total} ₽</button>
            </div>
        `;
        document.body.appendChild(paymentPopup);

        paymentElement.mount('#payment-element');
        console.log('Payment element mounted:', document.getElementById('payment-element'));

        Telegram.WebApp.expand();
        setTimeout(() => {
            paymentPopup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            paymentPopup.querySelector('#payment-element').focus();
        }, 200);

        Telegram.WebApp.BackButton.show();
        Telegram.WebApp.BackButton.onClick(() => {
            paymentPopup.remove();
            Telegram.WebApp.BackButton.hide();
            localStorage.removeItem('currentOrderId');
        });

        const submitButton = paymentPopup.querySelector('#submit-payment');
        submitButton.addEventListener('click', async () => {
            submitButton.disabled = true;
            submitButton.textContent = 'Обработка...';

            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href
                }
            });

            if (error) {
                console.error('Ошибка Stripe:', error);
                showCustomAlert(`Ошибка оплаты: ${error.message}`);
                paymentPopup.remove();
                submitButton.disabled = false;
                submitButton.textContent = `Оплатить ${total} ₽`;
                localStorage.removeItem('currentOrderId');
            }
            // Успешная оплата обрабатывается в handlePaymentRedirect после редиректа
        });
    } catch (error) {
        console.error('Ошибка оплаты:', error);
        showCustomAlert(`Ошибка оплаты: ${error.message}`);
        localStorage.removeItem('currentOrderId');
    }
}

// Вызываем обработку параметров URL при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    stripe = Stripe('pk_test_51RWuClR53YSpLuMZjpMsSSbQTVAaO3dIyoEpDIpzrb6dRxvZceaH2mpDniwHpSKsR7WJVYYbeucIcHFjFsoNCnY000HbTeIFtC');
    window.stripe = stripe;
    handlePaymentRedirect(); // Обрабатываем параметры URL
    fetchProducts();
    fetchCart();
});
let stripe;
  // Инициализация Stripe (оставляем внутри DOMContentLoaded)
document.addEventListener('DOMContentLoaded', async () => {
    stripe = Stripe('pk_test_51RWuClR53YSpLuMZjpMsSSbQTVAaO3dIyoEpDIpzrb6dRxvZceaH2mpDniwHpSKsR7WJVYYbeucIcHFjFsoNCnY000HbTeIFtC');
    window.stripe = stripe; // Делаем stripe глобально доступным


});

// Запускаем загрузку данных
fetchProducts();
fetchCart();
