from pydantic import BaseModel, ConfigDict, computed_field, Field


class ComboItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1)


class ComboBase(BaseModel):
    name: str
    price: float = 0
    items: list[ComboItemIn]


class ComboCreate(ComboBase):
    pass


class ComboUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    items: list[ComboItemIn] | None = None


class ComboItemOut(BaseModel):
    product_id: str
    qty: int
    product_name: str = ""
    price: float = 0
    available: int = 0


class ComboOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    name: str
    price: float
    handed_over: int
    reserved: int
    items: list[ComboItemOut] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def regular_price(self) -> float:
        return sum(i.qty * i.price for i in self.items)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def remaining(self) -> int:
        if not self.items:
            return 0
        return min(max(0, i.available // i.qty) for i in self.items)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def savings(self) -> float:
        return self.regular_price - self.price

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sold(self) -> int:
        return self.handed_over
