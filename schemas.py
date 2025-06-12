# schemas.py
from pydantic import BaseModel
from typing import Optional, List
import datetime
from typing import Optional, Dict, Any

class ProductBase(BaseModel):
    name: str
    price: float
    img: Optional[str] = None
    category: str
    user_id: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    class Config:
        orm_mode = True

class CartItemBase(BaseModel):
    user_id: str
    product_id: int
    quantity: int

class CartItemCreate(CartItemBase):
    pass

class CartItemUpdate(BaseModel):  # Добавляем схему
    quantity: int

class CartItem(CartItemBase):
    id: int
    product: Product
    class Config:
        orm_mode = True

#verj
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int
    price: float

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    product: Product
    class Config:
        orm_mode = True

class OrderBase(BaseModel):
    user_id: str
    total: float
    phone: str
    address: str
    delivery_method: str
    payment_method: str

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class Order(OrderBase):
    id: int
    order_date: datetime.datetime
    status: str

class PreCheckoutQuery(BaseModel):
    id: str
    from_user: Dict[str, Any]
    invoice_payload: str
    total_amount: int

class SuccessfulPayment(BaseModel):
    order_info: Optional[Dict[str, Any]]
    telegram_payment_charge_id: str
    provider_payment_charge_id: str

class WebhookUpdate(BaseModel):
    update_id: int
    pre_checkout_query: Optional[PreCheckoutQuery]
    message: Optional[Dict[str, Any]]