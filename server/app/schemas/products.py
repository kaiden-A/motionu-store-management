from pydantic import BaseModel, ConfigDict, computed_field


class ProductBase(BaseModel):
    name: str
    category: str = "Other"
    price: float = 0
    stock: int = 0


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    price: float | None = None
    stock: int | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    handed_over: int
    reserved: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def remaining(self) -> int:
        return self.stock - self.handed_over - self.reserved

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sold(self) -> int:
        return self.handed_over
