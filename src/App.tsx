import { Item, ItemContent, ItemTitle } from "@/components/ui/item";

function App() {
  return (
    <div className="max-w-xs p-4">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle className="text-xl">Hello, World!</ItemTitle>
        </ItemContent>
      </Item>
    </div>
  );
}

export default App;
