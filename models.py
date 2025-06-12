from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base
import datetime
from typing import Optional, List

class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(index=True)
    price: Mapped[float] = mapped_column()
    img: Mapped[Optional[str]] = mapped_column(nullable=True)
    category: Mapped[str] = mapped_column()
    user_id: Mapped[Optional[str]] = mapped_column(nullable=True)

class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column()
    product: Mapped["Product"] = relationship()

class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(unique=True, index=True)
    is_admin: Mapped[bool] = mapped_column(default=False)

class Order(Base):
    __tablename__ = "orders"


    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(index=True)
    order_date: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    payment_date: Mapped[Optional[datetime.datetime]] = mapped_column(nullable=True)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(index=True)
    order_date: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    total: Mapped[float] = mapped_column()
    phone: Mapped[str] = mapped_column()
    address: Mapped[str] = mapped_column()
    delivery_method: Mapped[str] = mapped_column()
    payment_method: Mapped[str] = mapped_column()
    status: Mapped[str] = mapped_column(default="В обработке")
    items: Mapped[List["OrderItem"]] = relationship(back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column()
    price: Mapped[float] = mapped_column()
    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()